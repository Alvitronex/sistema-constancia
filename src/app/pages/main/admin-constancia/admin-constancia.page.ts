import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { Constancia } from 'src/app/models/constancia.model';
import { orderBy } from '@angular/fire/firestore';
import * as pdfMake from 'pdfmake/build/pdfmake';

@Component({
  selector: 'app-admin-constancia',
  templateUrl: './admin-constancia.page.html',
  styleUrls: ['./admin-constancia.page.scss'],
})
export class AdminConstanciaPage implements OnInit, OnDestroy {
  constancias$: Observable<Constancia[]>;
  loading = true;
  error = false;
  searchControl = new FormControl('');
  tipoControl = new FormControl('todos');
  estadoControl = new FormControl('todos');
  private destroy$ = new Subject<void>();

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
    private utilsSvc: UtilsService
  ) { }

  ngOnInit() {
    this.loadConstancias();
    this.setupSearchListener();
    this.setupFilterListeners();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadConstancias() {
    try {
      this.loading = true;
      this.error = false;

      const constanciasRef = this.firebaseSvc.getCollectionData(
        'constancias',
        [orderBy('createdAt', 'desc')]
      ) as Observable<Constancia[]>;

      this.constancias$ = constanciasRef.pipe(
        tap({
          next: (data) => {
            console.log('Constancias loaded:', data);
            this.loading = false;
          },
          error: (error) => {
            console.error('Error loading constancias:', error);
            this.error = true;
            this.loading = false;
            this.utilsSvc.presentToast({
              message: 'Error al cargar constancias',
              duration: 2500,
              color: 'danger',
              position: 'bottom'
            });
          }
        }),
        takeUntil(this.destroy$)
      );
    } catch (error) {
      console.error('Error in loadConstancias:', error);
      this.error = true;
      this.loading = false;
    }
  }

  private setupSearchListener() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      console.log('Search term:', searchTerm);
      // Aquí puedes implementar la lógica de búsqueda
      this.loadConstancias();
    });
  }

  private setupFilterListeners() {
    // Escuchar cambios en el filtro de tipo
    this.tipoControl.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(tipo => {
      console.log('Tipo selected:', tipo);
      this.loadConstancias();
    });

    // Escuchar cambios en el filtro de estado
    this.estadoControl.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(estado => {
      console.log('Estado selected:', estado);
      this.loadConstancias();
    });
  }

  // Función para obtener el color del estado
  getStatusColor(estado: string): string {
    const estadoFound = this.estadosConstancia.find(e => e.value === estado);
    return estadoFound ? estadoFound.color : 'medium';
  }

  // Función de seguimiento para ngFor
  trackByFn(index: number, constancia: Constancia): string {
    return constancia.id;
  } async onUpdateStatus(constancia: Constancia, newStatus: string) {
    const alert = await this.utilsSvc.presentAlert({
      header: 'Confirmar cambio',
      message: `¿Está seguro de cambiar el estado a "${newStatus}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Aceptar',
          handler: async () => {
            const loading = await this.utilsSvc.loading();
            try {
              await loading.present();
              await this.firebaseSvc.updateConstanciaStatus(constancia.id, newStatus);
              
              this.utilsSvc.presentToast({
                message: 'Estado actualizado correctamente',
                color: 'success',
                duration: 2500,
                position: 'middle'
              });
            } catch (error) {
              console.error('Error al actualizar estado:', error);
              this.utilsSvc.presentToast({
                message: 'Error al actualizar el estado',
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

  async onViewDetails(constancia: Constancia) {
    await this.utilsSvc.presentAlert({
      header: 'Detalles de la Constancia',
      subHeader: `${constancia.tipo} - ${constancia.estado.toUpperCase()}`,
      message: `
        <strong>Solicitante:</strong> ${constancia.nombre} ${constancia.apellidos}<br>
        <strong>Documento:</strong> ${constancia.documento}<br>
        <strong>Motivo:</strong> ${constancia.motivo}<br>
        <strong>Fecha:</strong> ${new Date(constancia.createdAt).toLocaleString()}<br>
        <strong>Email:</strong> ${constancia.userEmail}
      `,
      buttons: ['Cerrar']
    });
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

      const docDefinition:any = {
        content: [
          { text: 'CONSTANCIA', style: 'header' },
          { 
            text: [
              { text: '\nTipo de Constancia: ', bold: true },
              constancia.tipo
            ]
          },
          {
            text: [
              { text: '\nNombre Completo: ', bold: true },
              `${constancia.nombre} ${constancia.apellidos}`
            ]
          },
          {
            text: [
              { text: '\nDocumento: ', bold: true },
              constancia.documento
            ]
          },
          {
            text: [
              { text: '\nMotivo: ', bold: true },
              constancia.motivo
            ]
          },
          {
            text: [
              { text: '\nFecha de Emisión: ', bold: true },
              new Date().toLocaleDateString()
            ]
          }
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
            alignment: 'center',
            margin: [0, 0, 0, 20]
          }
        }
      };

      this.utilsSvc.pdfMake();
      pdfMake.createPdf(docDefinition).download(`constancia-${constancia.tipo}-${constancia.documento}.pdf`);

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
}