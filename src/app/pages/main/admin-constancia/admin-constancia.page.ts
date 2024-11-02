import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { Constancia } from 'src/app/models/constancia.model';
import { orderBy } from '@angular/fire/firestore';
// Agregar esto antes de la clase del componente
declare var pdfMake: any;

interface PdfDocumentDefinition {
  pageSize: string;
  pageMargins: number[];
  content: Array<{
    text?: string;
    style?: string;
    alignment?: string;
    columns?: Array<{
      text: string;
      style?: string;
      alignment?: string;
    }>;
  }>;
  styles: {
    [key: string]: {
      fontSize?: number;
      bold?: boolean;
      alignment?: string;
      italic?: boolean;
      margin?: number[];
      color?: string;
    };
  };
  defaultStyle: {
    font: string;
  };
}
@Component({
  selector: 'app-admin-constancia',
  templateUrl: './admin-constancia.page.html',
  styleUrls: ['./admin-constancia.page.scss'],
})
export class AdminConstanciaPage implements OnInit, OnDestroy {
  constancias$: Observable<Constancia[]>;
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
    // Usamos el método getCollectionData como está definido originalmente
    this.constancias$ = this.firebaseSvc.getCollectionData(
      'constancias',
      [orderBy('createdAt', 'desc')]
    ) as Observable<Constancia[]>;
  }

  private setupSearchListener() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.loadConstancias();
    });
  }

  private setupFilterListeners() {
    this.tipoControl.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.loadConstancias();
    });

    this.estadoControl.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.loadConstancias();
    });
  }

  // Función de seguimiento para ngFor
  trackByFn(index: number, constancia: Constancia): string {
    return constancia.id;
  }

  async onUpdateStatus(constancia: Constancia, newStatus: string) {
    const confirmAlert = await this.utilsSvc.presentAlert({
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

      // Aquí es donde aplicamos la interfaz
      const docDefinition: PdfDocumentDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: [
          {
            text: 'CONSTANCIA',
            style: 'header'
          },
          {
            text: '\n\n'
          },
          {
            text: 'Por medio de la presente se certifica que:',
            style: 'subheader'
          },
          {
            text: '\n'
          },
          {
            text: `${constancia.nombre} ${constancia.apellidos}`,
            style: 'nombre'
          },
          {
            text: '\n\n'
          },
          {
            text: `Con documento de identidad: ${constancia.documento}`,
            style: 'documento'
          },
          {
            text: '\n\n'
          },
          {
            text: `Solicita constancia de ${constancia.tipo.toLowerCase()} por motivo de:`,
            style: 'motivo'
          },
          {
            text: constancia.motivo,
            style: 'motivoTexto'
          },
          {
            text: '\n\n\n'
          },
          {
            columns: [
              {
                text: `Fecha de emisión: ${new Date().toLocaleDateString()}`,
                style: 'fecha'
              },
              {
                text: `Folio: ${constancia.id}`,
                style: 'folio'
              }
            ]
          },
          {
            text: '\n\n\n\n'
          },
          {
            columns: [
              {
                text: '______________________',
                alignment: 'center'
              },
              {
                text: '______________________',
                alignment: 'center'
              }
            ]
          },
          {
            columns: [
              {
                text: 'Firma del Solicitante',
                alignment: 'center',
                style: 'firma'
              },
              {
                text: 'Sello y Firma',
                alignment: 'center',
                style: 'firma'
              }
            ]
          }
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
            alignment: 'center'
          },
          subheader: {
            fontSize: 16,
            alignment: 'center'
          },
          nombre: {
            fontSize: 14,
            bold: true,
            alignment: 'center'
          },
          documento: {
            fontSize: 12,
            alignment: 'center'
          },
          motivo: {
            fontSize: 12
          },
          motivoTexto: {
            fontSize: 12,
            italic: true,
            alignment: 'justify'
          },
          fecha: {
            fontSize: 10
          },
          folio: {
            fontSize: 10,
            color: 'grey'
          },
          firma: {
            fontSize: 10,
            margin: [0, 5, 0, 0]
          }
        },
        defaultStyle: {
          font: 'Helvetica'
        }
      };

      // Configurar pdfMake
      this.utilsSvc.pdfMake();

      // Generar y descargar el PDF
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.download(`constancia_${constancia.tipo.toLowerCase()}_${constancia.id}.pdf`);

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

  getStatusColor(estado: string): string {
    const estadoFound = this.estadosConstancia.find(e => e.value === estado);
    return estadoFound ? estadoFound.color : 'medium';
  }
}