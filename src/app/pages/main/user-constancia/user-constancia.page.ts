import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { Constancia } from 'src/app/models/constancia.model';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { User } from 'src/app/models/user.models';

@Component({
  selector: 'app-user-constancia',
  templateUrl: './user-constancia.page.html',
  styleUrls: ['./user-constancia.page.scss'],
})
export class UserConstanciaPage implements OnInit {

  form: FormGroup;
  user = {} as User;
  constancias: Observable<Constancia[]>;
  selectedSegment = 'generar';

  constructor(
    private firebaseSvc: FirebaseService,
    private utilsSvc: UtilsService,
    private fb: FormBuilder
  ) { }

  ngOnInit() {
    this.user = this.utilsSvc.getFromLocalStorage('user');
    this.initForm();
    this.getConstancias();
  }

  // Inicializar formulario
  initForm() {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      documento: ['', [Validators.required, Validators.minLength(5)]],
      tipo: ['', Validators.required],
      motivo: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  // Obtener constancias del usuario
  getConstancias() {
    if (this.user?.uid) {
      this.constancias = this.firebaseSvc.getConstanciasUser(this.user.uid);
    }
  }

  // Color del badge según estado
  getStatusColor(estado: string): string {
    const colors = {
      pendiente: 'warning',
      aprobada: 'success',
      rechazada: 'danger'
    };
    return colors[estado] || 'medium';
  }

  // Enviar formulario
  async submit() {
    if (this.form.valid) {
      const loading = await this.utilsSvc.loading();
      await loading.present();

      try {
        const constancia = {
          ...this.form.value,
          userId: this.user.uid,
          userEmail: this.user.email,
          estado: 'aprobada',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await this.firebaseSvc.createConstancia(constancia);

        this.utilsSvc.presentToast({
          message: 'Constancia generada exitosamente',
          duration: 2500,
          color: 'success',
          position: 'middle'
        });

        this.form.reset();
        this.selectedSegment = 'historial';

      } catch (error) {
        console.log(error);
        this.utilsSvc.presentToast({
          message: 'Error al generar la constancia',
          duration: 2500,
          color: 'danger',
          position: 'middle'
        });
      }

      loading.dismiss();
    } else {
      this.utilsSvc.presentToast({
        message: 'Por favor, complete todos los campos correctamente',
        duration: 2500,
        color: 'warning',
        position: 'middle'
      });
    }
  }

  // Generar PDF
  async generarPDF(constancia: Constancia) {
    if (constancia.estado !== 'aprobada') {
      this.utilsSvc.presentToast({
        message: 'La constancia debe estar aprobada para generar el PDF',
        duration: 2500,
        color: 'warning',
        position: 'middle'
      });
      return;
    }

    const loading = await this.utilsSvc.loading();
    await loading.present();

    try {
      // Definición del documento con tipos correctos
      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: [
          { text: 'CONSTANCIA', style: 'header' },
          { text: '\n\n' },
          { text: 'Por medio de la presente se certifica que:', style: 'subheader' },
          { text: '\n' },
          { text: `${constancia.nombre} ${constancia.apellidos}`, style: 'nombre' },
          { text: '\n\n' },
          { text: `Con documento de identidad: ${constancia.documento}`, style: 'documento' },
          { text: '\n\n' },
          { text: `Solicita constancia de ${constancia.tipo.toLowerCase()} por motivo de:`, style: 'motivo' },
          { text: constancia.motivo, style: 'motivoTexto' },
          { text: '\n\n\n' },
          {
            columns: [
              { text: `Fecha de emisión: ${new Date().toLocaleDateString()}`, style: 'fecha' },
              { text: `Folio: ${constancia.id}`, style: 'folio' }
            ]
          },
          { text: '\n\n\n\n' },
          {
            columns: [
              { text: '______________________', alignment: 'center' },
              { text: '______________________', alignment: 'center' }
            ]
          },
          {
            columns: [
              { text: 'Firma del Solicitante', alignment: 'center', style: 'firma' },
              { text: 'Sello y Firma', alignment: 'center', style: 'firma' }
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
            color: 'grey'
          }
        }
      };

      // Crear y descargar el PDF
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.download(`constancia_${constancia.tipo}_${constancia.id}.pdf`);

    } catch (error) {
      console.log(error);
      this.utilsSvc.presentToast({
        message: 'Error al generar PDF',
        duration: 2500,
        color: 'danger',
        position: 'middle'
      });
    } finally {
      loading.dismiss();
    }
  }
  // Verificar errores en campos
  hasError(control: string, error: string): boolean {
    const field = this.form.get(control);
    return field?.getError(error) && field?.touched;
  }

  // Limpiar formulario
  resetForm() {
    this.form.reset();
    this.utilsSvc.presentToast({
      message: 'Formulario limpiado',
      duration: 1500,
      color: 'medium',
      position: 'middle'
    });
  }
}