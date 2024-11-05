import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, map, startWith, take } from 'rxjs/operators';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { Constancia } from 'src/app/models/constancia.model';
import { orderBy } from '@angular/fire/firestore';
import { groupBy } from 'lodash';
import { ModalController } from '@ionic/angular';
import { ConstanciaDetailComponent } from 'src/app/shared/components/constancia-detail/constancia-detail.component';
import { EditConstanciaComponent } from 'src/app/shared/components/edit-constancia/edit-constancia.component';
import { User } from 'src/app/models/user.models';
import { CreateConstanciaComponent } from 'src/app/shared/components/create-constancia/create-constancia.component';

declare var pdfMake: any;

@Component({
  selector: 'app-admin-constancia',
  templateUrl: './admin-constancia.page.html',
  styleUrls: ['./admin-constancia.page.scss'],
})
export class AdminConstanciaPage implements OnInit, OnDestroy {
  constancias$: Observable<Constancia[]>;
  filteredConstancias$: Observable<Constancia[]>;
  loading = true;
  error = false;
  searchControl = new FormControl('');
  tipoControl = new FormControl('todos');
  estadoControl = new FormControl('todos');
  private destroy$ = new Subject<void>();
  private allConstancias: Constancia[] = [];
  availableMonths: { year: number, month: number }[] = [];
  selectedMonths: { year: number, month: number }[] = [];

  Math = Math; // Para usar Math en el template
  paginatedConstancias: Constancia[] = [];
  pageSize: number = 8;
  currentPage: number = 1;
  totalPages: number = 1;
  pages: number[] = [];
  // Tipos de constancias disponibles
  tiposConstancia = [
    { value: 'LABORAL', label: 'Laboral' },
    { value: 'ESTUDIOS', label: 'Estudios' },
    { value: 'RESIDENCIA', label: 'Residencia' }
  ];

  // Estados de constancias disponibles
  estadosConstancia = [
    { value: 'pendiente', label: 'Pendiente', color: 'warning' },
    { value: 'aprobada', label: 'Aprobada', color: 'success' },
    { value: 'rechazada', label: 'Rechazada', color: 'danger' }
  ];

  constructor(
    private firebaseSvc: FirebaseService,
    private utilsSvc: UtilsService,
    private modalController: ModalController
  ) { }

  async openConstanciaDetail(constancia: Constancia) {
    const modal = await this.modalController.create({
      component: ConstanciaDetailComponent,
      componentProps: { constancia }
    });
    return await modal.present();
  }

  ngOnInit() {
    this.loadConstancias();
    this.loadAvailableMonths();
  }


  isAdmin(): boolean {
    const user: User = this.utilsSvc.getFromLocalStorage('user');
    return user?.role === 'admin';
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAvailableMonths() {
    // Obtener las fechas únicas de las constancias
    const dates = [...new Set(this.allConstancias.map(c => c.createdAt))];

    // Generar la lista de meses disponibles
    this.availableMonths = dates.map(date => {
      const d = new Date(date);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }
  private filterConstancias(
    constancias: Constancia[],
    searchTerm: string,
    tipo: string,
    estado: string
  ): Constancia[] {
    searchTerm = searchTerm || '';

    return constancias.filter(constancia => {
      const searchString = [
        constancia.nombre,
        constancia.apellidos,
        constancia.documento
      ].join(' ').toLowerCase();

      const termToSearch = searchTerm.toLowerCase().trim();

      const matchesSearch = searchString.includes(termToSearch);
      const matchesTipo = tipo === 'todos' || constancia.tipo === tipo;
      const matchesEstado = estado === 'todos' || constancia.estado === estado;

      return matchesSearch && matchesTipo && matchesEstado;
    });
  }
  private loadConstancias() {
    try {
      this.loading = true;
      this.error = false;

      const constanciasRef = this.firebaseSvc.getCollectionData(
        'constancias',
        [orderBy('createdAt', 'desc')]
      ) as Observable<Constancia[]>;

      // Combinar todos los observables de filtros
      this.filteredConstancias$ = combineLatest([
        constanciasRef,
        this.searchControl.valueChanges.pipe(startWith('')),
        this.tipoControl.valueChanges.pipe(startWith('todos')),
        this.estadoControl.valueChanges.pipe(startWith('todos'))
      ]).pipe(
        debounceTime(300),
        map(([constancias, searchTerm, tipo, estado]) => {
          this.allConstancias = constancias;
          const filtered = this.filterConstancias(constancias, searchTerm, tipo, estado);
          this.totalPages = Math.ceil(filtered.length / this.pageSize);

          // Reset a primera página cuando cambian los filtros
          if (this.currentPage > this.totalPages) {
            this.currentPage = 1;
          }

          this.updatePaginatedConstancias(filtered);
          this.updatePagination();
          this.loading = false;
          return filtered;
        }),
        takeUntil(this.destroy$)
      );

      // Mantener la suscripción activa
      this.filteredConstancias$.subscribe();

    } catch (error) {
      console.error('Error in loadConstancias:', error);
      this.error = true;
      this.loading = false;
    }
  }

  // Agregar métodos de paginación
  updatePaginatedConstancias(constancias: Constancia[]) {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedConstancias = constancias.slice(start, end);
  }

  updatePagination() {
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(this.totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    this.pages = Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i
    );
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      // Actualizar con los filtros actuales
      combineLatest([
        of(this.allConstancias),
        of(this.searchControl.value || ''),
        of(this.tipoControl.value || 'todos'),
        of(this.estadoControl.value || 'todos')
      ]).pipe(
        take(1),
        map(([constancias, searchTerm, tipo, estado]) => {
          const filtered = this.filterConstancias(constancias, searchTerm, tipo, estado);
          this.updatePaginatedConstancias(filtered);
          this.updatePagination();
        })
      ).subscribe();
    }
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  // Modificar el método clearFilters existente
  clearFilters() {
    this.searchControl.setValue('');
    this.tipoControl.setValue('todos');
    this.estadoControl.setValue('todos');
    this.currentPage = 1; // Resetear a la primera página
  }


  getStatusColor(estado: string): string {
    const estadoFound = this.estadosConstancia.find(e => e.value === estado);
    return estadoFound ? estadoFound.color : 'medium';
  }

  async onUpdateStatus(constancia: Constancia, newStatus: string) {
    // Si el estado es el mismo, no hacemos nada
    if (constancia.estado === newStatus) return;

    // Obtener la etiqueta del nuevo estado
    const estadoLabel = this.estadosConstancia.find(e => e.value === newStatus)?.label || newStatus;


  }

  async onGeneratePDF(constancia: Constancia) {
    if (constancia.estado !== 'aprobada') {
      this.utilsSvc.presentToast({
        message: 'Solo se pueden generar PDF de constancias aprobadas',
        color: 'warning',
        duration: 2500,
        position: 'middle'
      });
      return;
    }

    const loading = await this.utilsSvc.loading();
    try {
      await loading.present();

      // Formatear la fecha actual
      const fechaEmision = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: [
          {
            text: 'CONSTANCIA',
            style: 'header',
            margin: [0, 0, 0, 20]
          },
          {
            text: 'A QUIEN CORRESPONDA:',
            style: 'subheader',
            margin: [0, 20, 0, 20]
          },
          {
            text: [
              'Por medio de la presente se hace constar que ',
              { text: `${constancia.nombre} ${constancia.apellidos}`, bold: true },
              ', identificado(a) con documento número ',
              { text: constancia.documento, bold: true },
              ', solicita una constancia de tipo ',
              { text: constancia.tipo.toLowerCase(), bold: true },
              ' por el siguiente motivo:\n\n'
            ],
            margin: [0, 0, 0, 20]
          },
          {
            text: constancia.motivo,
            margin: [20, 0, 20, 20],
            italics: true
          },
          {
            text: `\nFecha de emisión: ${fechaEmision}`,
            alignment: 'right',
            margin: [0, 30, 0, 20]
          },
          {
            text: '_______________________\nFirma Autorizada',
            alignment: 'center',
            margin: [0, 50, 0, 0]
          }
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
            alignment: 'center'
          },
          subheader: {
            fontSize: 14,
            bold: true
          }
        }
      };

      this.utilsSvc.pdfMake();

      pdfMake.createPdf(docDefinition).open();  // Cambiamos a .open() directamente

      this.utilsSvc.presentToast({
        message: 'PDF generado correctamente',
        color: 'success',
        duration: 2500,
        position: 'middle'
      });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      this.utilsSvc.presentToast({
        message: 'Error al generar el PDF',
        color: 'danger',
        duration: 2500,
        position: 'middle'
      });
    } finally {
      loading.dismiss();
    }
  }

  // Método auxiliar para obtener el logo en base64

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
        const docDefinition = {
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
  async onDeleteConstancia(constancia: Constancia) {
    // Verificar si el usuario es admin antes de proceder
    if (!this.isAdmin()) {
      this.utilsSvc.presentToast({
        message: 'No tienes permisos para eliminar constancias',
        color: 'warning',
        duration: 2500,
        position: 'middle'
      });
      return;
    }

    // Mostrar alerta de confirmación
    const alert = await this.utilsSvc.presentAlert({
      header: 'Confirmar eliminación',
      mode: 'ios',
      message: '¿Está seguro de eliminar esta constancia? Esta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            const loading = await this.utilsSvc.loading();
            try {
              await loading.present();
              await this.firebaseSvc.deleteConstancia(constancia.id);

              this.utilsSvc.presentToast({
                message: 'Constancia eliminada correctamente',
                color: 'success',
                duration: 2500,
                position: 'middle'
              });
              // Recargar la lista de constancias
              this.loadConstancias();
            } catch (error) {
              console.error('Error al eliminar constancia:', error);
              this.utilsSvc.presentToast({
                message: 'Error al eliminar la constancia',
                color: 'danger',
                duration: 2500,
                position: 'middle'
              });
            } finally {
              loading.dismiss();
            }
          }
        }
      ]
    });
  }


  async onEditConstancia(constancia: Constancia) {
    // Verificar si el usuario es admin antes de proceder
    if (!this.isAdmin()) {
      this.utilsSvc.presentToast({
        message: 'No tienes permisos para editar constancias',
        color: 'warning',
        duration: 2500,
        position: 'middle'
      });
      return;
    }

    const modal = await this.modalController.create({
      component: EditConstanciaComponent,
      componentProps: {
        constancia
      },
      cssClass: 'modal-full-right-side'
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.updated) {
      // Recargar las constancias si se realizó una actualización
      this.loadConstancias();
    }
  }
  async createConstancia() {
    const modal = await this.modalController.create({
      component: CreateConstanciaComponent,
      cssClass: 'modal-full-right-side'
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.created) {
      this.loadConstancias();
    }
  }
}