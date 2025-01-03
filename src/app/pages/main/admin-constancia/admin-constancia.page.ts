import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, map, startWith, take, mergeMap } from 'rxjs/operators';
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
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { Platform } from '@ionic/angular';
import { EmailService } from 'src/app/services/email.service';
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
    { value: 'aprobada', label: 'Aprobada', color: 'success' }, // Corregido 'laabel' a 'label'
    { value: 'rechazada', label: 'Rechazada', color: 'danger' }
  ];

  constructor(
    private firebaseSvc: FirebaseService,
    private utilsSvc: UtilsService,
    private modalController: ModalController,
    private platform: Platform,
    private fileOpener: FileOpener,
    private emailSvc: EmailService,

  ) { }
  verInforme() {
    this.utilsSvc.routerLink('/main/constancia-reporte');
  }
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
  private async loadConstancias() {
    try {
      this.loading = true;
      this.error = false;

      // Primero obtener todos los usuarios
      const usersRef = this.firebaseSvc.getCollectionData(
        'users',
        [orderBy('name', 'desc')]
      ) as Observable<User[]>;

      // Transformar el observable de usuarios para obtener las constancias
      this.filteredConstancias$ = usersRef.pipe(
        mergeMap(users => {
          // Por cada usuario, crear un observable de sus constancias
          const constanciasObservables = users.map(user => {
            const path = `users/${user.uid}/constancia`;
            return this.firebaseSvc.getCollectionData(
              path,
              [orderBy('createdAt', 'desc')]
            ).pipe(
              // Agregar el userId a cada constancia
              map((constancias: Constancia[]) =>
                constancias.map(constancia => ({
                  ...constancia,
                  userId: user.uid,
                  userName: user.name,
                  userEmail: user.email,
                  userRole: user.role
                }))
              )
            );
          });

          // Combinar todas las constancias
          return combineLatest(constanciasObservables).pipe(
            map(constanciasArrays => {
              // Aplanar el array de arrays de constancias
              return constanciasArrays.reduce((acc, curr) => [...acc, ...curr], []);
            })
          );
        }),
        // Combinar con los filtros
        mergeMap(allConstancias => {
          return combineLatest([
            of(allConstancias),
            this.searchControl.valueChanges.pipe(startWith('')),
            this.tipoControl.valueChanges.pipe(startWith('todos')),
            this.estadoControl.valueChanges.pipe(startWith('todos'))
          ]).pipe(
            debounceTime(300),
            map(([constancias, searchTerm, tipo, estado]) => {
              this.allConstancias = constancias;
              const filtered = this.filterConstancias(constancias, searchTerm, tipo, estado);
              this.totalPages = Math.ceil(filtered.length / this.pageSize);

              if (this.currentPage > this.totalPages) {
                this.currentPage = 1;
              }

              this.updatePaginatedConstancias(filtered);
              this.updatePagination();
              this.loading = false;
              return filtered;
            })
          );
        }),
        takeUntil(this.destroy$)
      );

      // Suscribirse al observable
      this.filteredConstancias$.subscribe(
        () => {
          this.loading = false;
        },
        error => {
          console.error('Error loading constancias:', error);
          this.error = true;
          this.loading = false;
        }
      );

    } catch (error) {
      console.error('Error in loadConstancias:', error);
      this.error = true;
      this.loading = false;
    }
  }

  // === Confirmar eliminación de constancia ===
  async onDeleteConstancia(constancia: Constancia) {
    if (!this.isAdmin()) {
      this.utilsSvc.presentToast({
        message: 'No tienes permisos para eliminar constancias',
        color: 'warning',
        duration: 2500,
        position: 'middle'
      });
      return;
    }

    const alert = await this.utilsSvc.presentAlert({
      header: 'Confirmar eliminación',
      mode: 'ios',
      message: '¿Está seguro de eliminar esta constancia? Esta acción no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            const loading = await this.utilsSvc.loading();
            try {
              await loading.present();

              // Usar el path correcto con el userId
              const path = `users/${constancia.userId}/constancia/${constancia.id}`;
              await this.firebaseSvc.deleteDocument(path);

              this.utilsSvc.presentToast({
                message: 'Constancia eliminada correctamente',
                color: 'success',
                duration: 2500,
                position: 'middle'
              });

              // Recargar las constancias
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

  isAdmin(): boolean {
    const user: User = this.utilsSvc.getFromLocalStorage('user');
    return user?.role === 'admin';
  }
  isPlanillero(): boolean {
    const user: User = this.utilsSvc.getFromLocalStorage('user');
    return user?.role === 'planillero';
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
        constancia.documento,
        constancia.nombre,
        constancia.userId,
        constancia.userEmail
      ].join(' ').toLowerCase();

      const termToSearch = searchTerm.toLowerCase().trim();

      const matchesSearch = searchString.includes(termToSearch);
      const matchesTipo = tipo === 'todos' || constancia.tipo === tipo;
      const matchesEstado = estado === 'todos' || constancia.estado === estado;

      return matchesSearch && matchesTipo && matchesEstado;
    });
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
    // Verificar permisos
    if (!this.isAdmin() && !this.isPlanillero()) {
      this.utilsSvc.presentToast({
        message: 'No tienes permisos para cambiar el estado de las constancias',
        color: 'warning',
        duration: 2500,
        position: 'middle'
      });
      return;
    }

    // Verificar si el estado es diferente
    if (constancia.estado === newStatus) return;

    const estadoLabel = this.estadosConstancia.find(e => e.value === newStatus)?.label || newStatus;

    const alert = await this.utilsSvc.presentAlert({
      header: 'Cambiar Estado',
      message: `¿Está seguro de cambiar el estado a ${estadoLabel}?`,
      mode: 'ios',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sí, cambiar',
          handler: async () => {
            const loading = await this.utilsSvc.loading();
            try {
              await loading.present();

              // 1. Actualizar el documento
              const path = `users/${constancia.userId}/constancia/${constancia.id}`;
              const updatedConstancia = {
                ...constancia,
                estado: newStatus,
                updatedAt: new Date().toISOString()
              };

              await this.firebaseSvc.updateDocument(path, updatedConstancia);

              // 2. Si es aprobada, generar PDF y enviar correo
              if (newStatus === 'aprobada') {
                const fechaEmision = new Date().toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                });

                const docDefinition: any = {
                  content: [
                    {
                      text: 'CONSTANCIA',
                      style: 'header'
                    },
                    {
                      text: '\nA QUIEN CORRESPONDA:',
                      style: 'subheader'
                    },
                    {
                      text: [
                        '\nPor medio de la presente se hace constar que ',
                        { text: `${constancia.nombre} ${constancia.apellidos}`, bold: true },
                        ', identificado(a) con documento número ',
                        { text: constancia.documento, bold: true },
                        ', solicita una constancia de tipo ',
                        { text: constancia.tipo.toLowerCase(), bold: true },
                        ' por el siguiente motivo:\n\n'
                      ]
                    },
                    {
                      text: constancia.motivo,
                      italics: true,
                      margin: [20, 0, 20, 20]
                    },
                    {
                      text: `\nFecha de emisión: ${fechaEmision}`,
                      alignment: 'right',
                      margin: [0, 20, 0, 40]
                    },
                    {
                      text: '_______________________\nFirma Autorizada',
                      alignment: 'center'
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
                      fontSize: 14,
                      bold: true
                    }
                  }
                };

                const pdfDoc = pdfMake.createPdf(docDefinition);
                const pdfBase64 = await new Promise<string>((resolve) => {
                  pdfDoc.getBase64((data) => resolve(data));
                });

                try {
                  // Usar el correo almacenado en la constancia
                  await this.emailSvc.sendStatusUpdateEmail(
                    updatedConstancia,
                    newStatus,
                    pdfBase64
                  );
                } catch (emailError) {
                  console.error('Error al enviar el correo:', emailError);
                  this.utilsSvc.presentToast({
                    message: 'Estado actualizado pero hubo un error al enviar el correo',
                    color: 'warning',
                    duration: 4000,
                    position: 'middle',
                    icon: 'warning-outline'
                  });
                }
              } else {
                // Para otros estados, enviar correo sin PDF
                try {
                  await this.emailSvc.sendStatusUpdateEmail(
                    updatedConstancia,
                    newStatus
                  );
                } catch (emailError) {
                  console.error('Error al enviar el correo:', emailError);
                  this.utilsSvc.presentToast({
                    message: 'Estado actualizado pero hubo un error al enviar el correo',
                    color: 'warning',
                    duration: 4000,
                    position: 'middle',
                    icon: 'warning-outline'
                  });
                }
              }

              // 3. Mostrar mensaje de éxito
              this.utilsSvc.presentToast({
                message: `Estado actualizado a ${estadoLabel}`,
                color: 'success',
                duration: 2500,
                position: 'middle',
                icon: 'checkmark-circle-outline'
              });

              // 4. Recargar la lista de constancias
              await this.loadConstancias();

            } catch (error) {
              console.error('Error al actualizar estado:', error);
              this.utilsSvc.presentToast({
                message: 'Error al actualizar el estado',
                color: 'danger',
                duration: 2500,
                position: 'middle',
                icon: 'alert-circle-outline'
              });
            } finally {
              loading.dismiss();
            }
          }
        }
      ]
    });
  }
  // Método auxiliar para generar el PDF
  private generatePDF(constancia: Constancia) {
    const docDefinition = {
      content: [
        {
          text: 'CONSTANCIA',
          style: 'header'
        },
        {
          text: '\nA QUIEN CORRESPONDA:',
          style: 'subheader'
        },
        {
          text: [
            '\nPor medio de la presente se hace constar que ',
            { text: `${constancia.nombre} ${constancia.apellidos}`, bold: true },
            ', identificado(a) con documento número ',
            { text: constancia.documento, bold: true },
            ', solicita una constancia de tipo ',
            { text: constancia.tipo.toLowerCase(), bold: true },
            ' por el siguiente motivo:\n\n'
          ]
        },
        {
          text: constancia.motivo,
          italics: true,
          margin: [20, 0, 20, 20]
        },
        {
          text: `Estado: ${constancia.estado.toUpperCase()}`,
          alignment: 'left',
          color: 'green',
          margin: [0, 20, 0, 20]
        },
        {
          text: `\nFecha de emisión: ${new Date().toLocaleDateString()}`,
          alignment: 'right',
          margin: [0, 20, 0, 40]
        },
        {
          text: '_______________________\nFirma Autorizada',
          alignment: 'center'
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
          fontSize: 14,
          bold: true
        }
      }
    };

    return pdfMake.createPdf(docDefinition);
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

      const fechaEmision = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const docDefinition: any = {
        // ... (sin cambios)
      };

      this.utilsSvc.pdfMake();
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);

      pdfDocGenerator.getBase64(async (base64data) => {
        try {
          // Enviar correo electrónico
          const emailSubject = 'Constancia Aprobada';
          const emailBody = `
            <div>
              <h2>Constancia Aprobada</h2>
              <p>Estimado/a ${constancia.nombre} ${constancia.apellidos},</p>
              <p>Su constancia ha sido aprobada con los siguientes detalles:</p>
              <ul>
                <li><strong>Tipo:</strong> ${constancia.tipo}</li>
                <li><strong>Documento:</strong> ${constancia.documento}</li>
                <li><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</li>
                <li><strong>Motivo:</strong> ${constancia.motivo}</li>
              </ul>
              <p>Adjunto encontrará el archivo PDF de su constancia.</p>
              <p>Saludos cordiales,<br>El equipo de administración</p>
            </div>
          `;

          const mailtoLink = `mailto:${constancia.userEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
          window.location.href = mailtoLink;

          // Abrir el PDF
          pdfMake.createPdf(docDefinition).open();

          this.utilsSvc.presentToast({
            message: 'PDF generado y enviado por correo correctamente',
            color: 'success',
            duration: 2500,
            position: 'middle'
          });
        } catch (error) {
          console.error('Error al enviar correo:', error);
          this.utilsSvc.presentToast({
            message: 'PDF generado pero hubo un error al enviar el correo',
            color: 'warning',
            duration: 2500,
            position: 'middle'
          });
          // Abrir el PDF de todos modos
          pdfMake.createPdf(docDefinition).open();
        }
      });

    } catch (error) {
      console.error('Error generando PDF:', error);
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


  async onEditConstancia(constancia: Constancia) {
    // Verificar si el usuario es admin
    if (!this.isAdmin()) {
      this.utilsSvc.presentToast({
        message: 'No tienes permisos para editar constancias',
        color: 'warning',
        duration: 2500,
        position: 'middle'
      });
      return;
    }

    // Crear el modal
    const modal = await this.modalController.create({
      component: EditConstanciaComponent,
      componentProps: {
        constancia: { ...constancia }, // Pasar una copia de la constancia
        path: `users/${constancia.userId}/constancia/${constancia.id}` // Pasar el path correcto
      },
      cssClass: 'modal-full-right-side'
    });

    await modal.present();

    // Manejar el resultado del modal
    const { data } = await modal.onWillDismiss();
    if (data?.updated) {
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