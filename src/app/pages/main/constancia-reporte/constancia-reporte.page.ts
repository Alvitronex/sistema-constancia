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

  async generarPDF() {
    if (!this.stats) return;

    try {
      const loading = await this.utilsSvc.loading();
      await loading.present();

      const docDefinition: any = {
        content: [
          {
            text: 'Reporte de Constancias',
            style: 'header'
          },
          {
            text: `${this.selectedMonth === 'all' ? 'Año' : 'Mes'} ${this.selectedYear}`,
            style: 'subheader'
          },
          {
            text: `Fecha de generación: ${new Date().toLocaleDateString()}`,
            margin: [0, 0, 0, 20]
          },
          {
            table: {
              headerRows: 1,
              widths: ['*', '*', '*'],
              body: [
                ['Estado', 'Cantidad', 'Porcentaje'],
                ['Aprobadas', this.stats.aprobadas, `${((this.stats.aprobadas / this.getTotalConstancias()) * 100).toFixed(1)}%`],
                ['Rechazadas', this.stats.rechazadas, `${((this.stats.rechazadas / this.getTotalConstancias()) * 100).toFixed(1)}%`],
                ['Pendientes', this.stats.pendientes, `${((this.stats.pendientes / this.getTotalConstancias()) * 100).toFixed(1)}%`],
                ['Total', this.getTotalConstancias(), '100%']
              ]
            }
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
          }
        }
      };

      this.utilsSvc.pdfMake();
      pdfMake.createPdf(docDefinition).download('reporte-constancias.pdf');

      await loading.dismiss();

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

  getTotalConstancias(): number {
    if (!this.stats) return 0;
    const total = (this.stats.aprobadas || 0) +
      (this.stats.rechazadas || 0) +
      (this.stats.pendientes || 0);
    return total;
  }
}