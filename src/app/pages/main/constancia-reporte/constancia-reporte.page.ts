import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { Chart, registerables } from 'chart.js';
import { Constancia } from 'src/app/models/constancia.model';
import { groupBy } from 'lodash';

Chart.register(...registerables);

@Component({
  selector: 'app-constancia-reporte',
  templateUrl: './constancia-reporte.page.html',
  styleUrls: ['./constancia-reporte.page.scss'],
})
export class ConstanciaReportePage implements OnInit, OnDestroy {
  @ViewChild('barChart') barChart: ElementRef;
  chart: any;
  availableMonths: { value: string, label: string }[] = [];

  selectedYear: number;
  selectedMonth: string = 'all';
  stats: any = null;
  loading = false;
  availableYears: number[] = [];
  months = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];
  private allConstancias: Constancia[] = [];

  constructor(
    private firebaseSvc: FirebaseService,
    private utilsSvc: UtilsService
  ) { }

  async ngOnInit() {
    await this.initializeYears();
    await this.updateAvailableMonths(); // Nuevo método
    this.loadStats();
  }



  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }
  private readonly monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  // Nuevo método para actualizar meses disponibles
  private async updateAvailableMonths() {
    try {
      const constancias = await this.firebaseSvc.getAllConstancias();

      // Filtrar constancias del año seleccionado
      const constanciasDelAño = constancias.filter(c => {
        const fecha = new Date(c.createdAt);
        return fecha.getFullYear() === this.selectedYear;
      });

      if (constanciasDelAño.length === 0) {
        this.availableMonths = [{ value: 'all', label: 'Todos los meses' }];
        this.selectedMonth = 'all';
        return;
      }

      // Obtener meses únicos
      const mesesUnicos = [...new Set(
        constanciasDelAño.map(c => {
          const fecha = new Date(c.createdAt);
          return fecha.getMonth();
        })
      )].sort((a, b) => a - b);

      // Crear array de meses disponibles
      this.availableMonths = [
        { value: 'all', label: 'Todos los meses' },
        ...mesesUnicos.map(mes => ({
          value: (mes + 1).toString(),
          label: this.monthNames[mes]
        }))
      ];

    } catch (error) {
      console.error('Error al cargar meses disponibles:', error);
      this.availableMonths = [{ value: 'all', label: 'Todos los meses' }];
      this.selectedMonth = 'all';
    }
  }

  // Modificar onYearChange para actualizar meses
  async onYearChange(event: any) {
    console.log('Año seleccionado:', event.detail.value);
    this.selectedYear = event.detail.value;
    await this.updateAvailableMonths(); // Actualizar meses disponibles
    this.selectedMonth = 'all'; // Reset mes seleccionado
    this.loadStats();
  }

  onMonthChange(event: any) {
    console.log('Mes seleccionado:', event.detail.value);
    this.selectedMonth = event.detail.value;
    this.loadStats();
  }

  private groupConstanciasByMonth(constancias: Constancia[]) {
    return groupBy(constancias, (constancia) => {
      const fecha = new Date(constancia.createdAt);
      return `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
    });
  }
  private prepareReportData(constanciasPorMes: any) {
    const meses = Object.keys(constanciasPorMes).sort();

    return meses.map(mes => {
      const constancias = constanciasPorMes[mes];
      const [year, month] = mes.split('-');

      return {
        mes: this.getMonthName(parseInt(month)) + ' ' + year,
        total: constancias.length,
        pendientes: constancias.filter(c => c.estado === 'pendiente').length,
        aprobadas: constancias.filter(c => c.estado === 'aprobada').length,
        rechazadas: constancias.filter(c => c.estado === 'rechazada').length
      };
    });
  }
  private getMonthName(month: number): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[month - 1];
  }
  async generateMonthlyReport() {
    try {
      // Lógica para generar el informe mensual
      const loading = await this.utilsSvc.loading();
      try {
        await loading.present();

        // Obtener todas las constancias
        const constancias = this.allConstancias;

        // Agrupar constancias por mes
        const constanciasPorMes = this.groupConstanciasByMonth(constancias);

        // Generar datos para el informe
        const reportData = this.prepareReportData(constanciasPorMes);

        // Crear el PDF
        const docDefinition: any = {
          content: [
            {
              text: 'INFORME DE CONSTANCIAS POR MES',
              style: 'header'
            },
            {
              text: `Fecha de generación: ${new Date().toLocaleDateString()}`,
              alignment: 'right',
              margin: [0, 0, 0, 20]
            },
            // Tabla de resumen
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  [
                    { text: 'Mes', style: 'tableHeader' },
                    { text: 'Total', style: 'tableHeader' },
                    { text: 'Pendientes', style: 'tableHeader' },
                    { text: 'Aprobadas', style: 'tableHeader' },
                    { text: 'Rechazadas', style: 'tableHeader' }
                  ],
                  ...reportData.map(row => [
                    row.mes,
                    row.total,
                    row.pendientes,
                    row.aprobadas,
                    row.rechazadas
                  ])
                ]
              }
            },
            // Gráfico de resumen (representación texto)
            {
              text: '\nResumen Anual',
              style: 'subheader',
              margin: [0, 20, 0, 10]
            },
            {
              text: [
                { text: '\nTotal de Constancias: ', bold: true },
                constancias.length.toString()
              ]
            },
            {
              text: [
                { text: '\nTotal Aprobadas: ', bold: true },
                constancias.filter(c => c.estado === 'aprobada').length.toString()
              ]
            },
            {
              text: [
                { text: '\nTotal Pendientes: ', bold: true },
                constancias.filter(c => c.estado === 'pendiente').length.toString()
              ]
            },
            {
              text: [
                { text: '\nTotal Rechazadas: ', bold: true },
                constancias.filter(c => c.estado === 'rechazada').length.toString()
              ]
            }
          ],
          styles: {
            header: {
              fontSize: 22,
              bold: true,
              alignment: 'center',
              margin: [0, 0, 0, 20]
            },
            subheader: {
              fontSize: 16,
              bold: true,
              margin: [0, 10, 0, 5]
            },
            tableHeader: {
              bold: true,
              fontSize: 13,
              color: 'black',
              fillColor: '#eeeeee'
            }
          },
          defaultStyle: {
            fontSize: 12
          }
        };

        this.utilsSvc.pdfMake();
        pdfMake.createPdf(docDefinition).download('informe-constancias-mensual.pdf');

        this.utilsSvc.presentToast({
          message: 'Informe generado correctamente',
          color: 'success',
          duration: 2500,
          position: 'middle'
        });
      } catch (error) {
        console.error('Error al generar informe:', error);
        this.utilsSvc.presentToast({
          message: 'Error al generar el informe',
          color: 'danger',
          duration: 2500,
          position: 'middle'
        });
      } finally {
        loading.dismiss();
      }
    } catch (error) {
      console.error('Error al generar informe:', error);
      this.utilsSvc.presentToast({
        message: 'Error al generar el informe',
        color: 'danger',
        duration: 2500,
        position: 'middle'
      });
    }
  }

  // Método auxiliar para obtener el mes con más constancias
  private getMesConMasConstancias(): string {
    if (!this.stats?.porMes?.length) return 'No hay datos';

    const mesMax = this.stats.porMes.reduce((max, mes) => {
      const totalMes = mes.aprobadas + mes.rechazadas + mes.pendientes;
      const totalMax = max.aprobadas + max.rechazadas + max.pendientes;
      return totalMes > totalMax ? mes : max;
    });

    return `${mesMax.mes} (${mesMax.aprobadas + mesMax.rechazadas + mesMax.pendientes} constancias)`;
  }
  // Añadir métodos específicos para cambios
  private async initializeYears() {
    try {
      // Obtener todas las constancias
      const constancias = await this.firebaseSvc.getAllConstancias();

      if (constancias.length === 0) {
        const currentYear = new Date().getFullYear();
        this.availableYears = [currentYear];
        this.selectedYear = currentYear;
        return;
      }

      // Obtener años únicos de las constancias existentes
      const uniqueYears = [...new Set(
        constancias.map(c => new Date(c.createdAt).getFullYear())
      )].sort((a, b) => b - a); // Ordenar descendente

      this.availableYears = uniqueYears;

      // Seleccionar el año más reciente por defecto
      this.selectedYear = uniqueYears[0];

    } catch (error) {
      console.error('Error initializing years:', error);
      // En caso de error, mostrar el año actual
      const currentYear = new Date().getFullYear();
      this.availableYears = [currentYear];
      this.selectedYear = currentYear;
    }
  }



  async loadStats() {
    let loading;
    try {
      loading = await this.utilsSvc.loading();
      await loading.present();

      console.log('Cargando estadísticas para:', {
        año: this.selectedYear,
        mes: this.selectedMonth
      });

      this.stats = await this.firebaseSvc.getConstanciasStats(
        this.selectedYear,
        this.selectedMonth
      );

      console.log('Estadísticas cargadas:', this.stats);

      if (loading) {
        await loading.dismiss();
        loading = null;
      }

      // Actualizar el gráfico
      setTimeout(() => {
        this.createOrUpdateChart();
      }, 100);

    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      this.utilsSvc.presentToast({
        message: 'Error al cargar las estadísticas',
        duration: 2500,
        color: 'danger',
        position: 'middle'
      });
    } finally {
      if (loading) {
        try {
          await loading.dismiss();
        } catch (err) {
          console.error('Error dismissing loading:', err);
        }
      }
      this.loading = false;
    }
  }


  createOrUpdateChart() {
    if (this.chart) {
      this.chart.destroy();
    }

    if (!this.stats?.porMes || this.stats.porMes.length === 0 || !this.barChart?.nativeElement) return;

    const data = this.stats.porMes;
    const labels = data.map(item => item.mes);
    const aprobadas = data.map(item => item.aprobadas);
    const rechazadas = data.map(item => item.rechazadas);
    const pendientes = data.map(item => item.pendientes);

    this.chart = new Chart(this.barChart.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Aprobadas',
            data: aprobadas,
            backgroundColor: '#10b981',
            borderColor: '#10b981',
            borderWidth: 1
          },
          {
            label: 'Rechazadas',
            data: rechazadas,
            backgroundColor: '#ef4444',
            borderColor: '#ef4444',
            borderWidth: 1
          },
          {
            label: 'Pendientes',
            data: pendientes,
            backgroundColor: '#f59e0b',
            borderColor: '#f59e0b',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            grid: {
              display: true,
              drawOnChartArea: true,
              drawTicks: true,
              color: '#e5e7eb'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          title: {
            display: false
          }
        }
      }
    });
  }



  // Método principal para generar PDF
  async generarPDF() {
    if (!this.stats) return;
    try {
      const loading = await this.utilsSvc.loading();
      await loading.present();

      // Obtener mes seleccionado para el título
      const mesSeleccionado = this.selectedMonth === 'all' ?
        'todos los meses' :
        this.months.find(m => m.value === this.selectedMonth)?.label;

      const docDefinition: any = {
        content: [
          {
            text: 'Reporte de Constancias',
            style: 'header'
          },
          {
            text: `Período: ${mesSeleccionado} ${this.selectedYear}`,
            style: 'subheader'
          },
          {
            text: `Fecha de generación: ${new Date().toLocaleDateString()}`,
            margin: [0, 0, 0, 20]
          }
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
            alignment: 'center',
            margin: [0, 0, 0, 10]
          },
          subheader: {
            fontSize: 16,
            bold: true,
            margin: [0, 10, 0, 5]
          },
          tableHeader: {
            bold: true,
            fontSize: 13,
            color: 'black',
            fillColor: '#eeeeee',
          }
        },
        defaultStyle: {
          fontSize: 12
        }
      };

      if (this.selectedMonth === 'all') {
        docDefinition.content.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', '*'],
            body: [
              [
                { text: 'Estado', style: 'tableHeader' },
                { text: 'Cantidad', style: 'tableHeader' },
                { text: 'Usuario', style: 'tableHeader' }
              ],
              [
                'Aprobadas',
                this.stats.aprobadas,
                this.getUsuariosEstadoAnual('aprobada')
              ],
              [
                'Rechazadas',
                this.stats.rechazadas,
                this.getUsuariosEstadoAnual('rechazada')
              ],
              [
                'Pendientes',
                this.stats.pendientes,
                this.getUsuariosEstadoAnual('pendiente')
              ],
              [
                { text: 'Total', bold: true },
                { text: this.getTotalConstancias(), bold: true },
                { text: 'Total Usuarios', bold: true }
              ]
            ]
          }
        });
      } else {
        docDefinition.content.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', '*'],
            body: [
              [
                { text: 'Estado', style: 'tableHeader' },
                { text: 'Cantidad', style: 'tableHeader' },
                { text: 'Usuario', style: 'tableHeader' }
              ],
              [
                'Aprobadas',
                this.stats.aprobadas,
                this.stats.aprobadas > 0 ? this.getUsuariosEstado('aprobada') : 'N/A'
              ],
              [
                'Rechazadas',
                this.stats.rechazadas,
                this.stats.rechazadas > 0 ? this.getUsuariosEstado('rechazada') : 'N/A'
              ],
              [
                'Pendientes',
                this.stats.pendientes,
                this.stats.pendientes > 0 ? this.getUsuariosEstado('pendiente') : 'N/A'
              ],
              [
                { text: 'Total', bold: true },
                { text: this.getTotalConstancias(), bold: true },
                { text: 'Total Usuarios', bold: true }
              ]
            ]
          }
        });

        docDefinition.content.push(
          {
            text: '\nDetalles del Mes',
            style: 'subheader',
            margin: [0, 20, 0, 10]
          },
          {
            ul: [
              `Total de Constancias Procesadas: ${this.getTotalConstancias()}`,
              `Total de Constancias Aprobadas: ${this.stats.aprobadas}`,
              `Total de Constancias Rechazadas: ${this.stats.rechazadas}`,
              `Total de Constancias Pendientes: ${this.stats.pendientes}`
            ]
          }
        );
      }

      this.utilsSvc.pdfMake();
      const fileName = this.selectedMonth === 'all'
        ? `reporte-constancias-${this.selectedYear}`
        : `reporte-constancias-${mesSeleccionado}-${this.selectedYear}`;

      pdfMake.createPdf(docDefinition).download(`${fileName}.pdf`);

      await loading.dismiss();

      this.utilsSvc.presentToast({
        message: 'PDF generado correctamente',
        duration: 2500,
        color: 'success',
        position: 'middle'
      });

    } catch (error) {
      console.error('Error al generar PDF:', error);
      this.utilsSvc.presentToast({
        message: 'Error al generar el PDF',
        duration: 2500,
        color: 'danger',
        position: 'middle'
      });
    } finally {
      const loading = await this.utilsSvc.loading();
      await loading.dismiss();
    }
  }



  // Método para obtener constancias filtradas por estado y fecha
  private getConstanciasPorEstado(estado: string): any[] {
    const fecha = new Date(this.selectedYear, parseInt(this.selectedMonth) - 1);
    return this.allConstancias.filter(c => {
      const constanciaFecha = new Date(c.createdAt);
      return c.estado === estado &&
        constanciaFecha.getMonth() === fecha.getMonth() &&
        constanciaFecha.getFullYear() === fecha.getFullYear();
    });
  }

  // Método para calcular el total de constancias
  getTotalConstancias(): number {
    if (!this.stats) return 0;
    const total = (this.stats.aprobadas || 0) +
      (this.stats.rechazadas || 0) +
      (this.stats.pendientes || 0);
    return total;
  }
  // Modificar el método getUsuariosEstado para mostrar nombre y apellido
  private getUsuariosEstado(estado: string): string {
    const constancias = this.getConstanciasPorEstado(estado);
    // Crear un Set de usuarios únicos con formato "nombre apellidos"
    const usuarios = [...new Set(constancias.map(c => `${c.nombre} ${c.apellidos}`))];
    return usuarios.join(', ') || 'N/A';
  }

  // Modificar el método getUsuariosEstadoAnual también
  private getUsuariosEstadoAnual(estado: string): string {
    const constanciasAño = this.allConstancias.filter(c => {
      const fecha = new Date(c.createdAt);
      return fecha.getFullYear() === this.selectedYear && c.estado === estado;
    });

    // Crear un Set de usuarios únicos con formato "nombre apellidos"
    const usuariosUnicos = [...new Set(constanciasAño.map(c => `${c.nombre} ${c.apellidos}`))];

    // Si la lista es muy larga, mostrar solo los primeros 3
    if (usuariosUnicos.length > 3) {
      return usuariosUnicos.slice(0, 3).join(', ') + '...';
    }

    return usuariosUnicos.length > 0 ? usuariosUnicos.join(', ') : 'N/A';
  }
}