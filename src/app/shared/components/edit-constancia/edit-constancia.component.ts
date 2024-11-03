import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Constancia } from 'src/app/models/constancia.model';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-edit-constancia',
  templateUrl: './edit-constancia.component.html',
  styleUrls: ['./edit-constancia.component.scss'],
})
export class EditConstanciaComponent  implements OnInit {
  @Input() constancia: Constancia;
  form: FormGroup;

  tiposConstancia = [
    { value: 'LABORAL', label: 'Laboral' },
    { value: 'ESTUDIOS', label: 'Estudios' },
    { value: 'RESIDENCIA', label: 'Residencia' }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private modalController: ModalController,
    private firebaseSvc: FirebaseService,
    private utilsSvc: UtilsService
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.form = this.formBuilder.group({
      nombre: [this.constancia.nombre, [Validators.required, Validators.minLength(3)]],
      apellidos: [this.constancia.apellidos, [Validators.required, Validators.minLength(3)]],
      documento: [this.constancia.documento, [Validators.required, Validators.minLength(8)]],
      tipo: [this.constancia.tipo, [Validators.required]],
      motivo: [this.constancia.motivo, [Validators.required, Validators.minLength(10)]]
    });
  }

  async onSubmit() {
    if (this.form.valid) {
      const loading = await this.utilsSvc.loading();
      try {
        await loading.present();
        
        const updatedData = {
          ...this.form.value,
          updatedAt: new Date().toISOString()
        };

        await this.firebaseSvc.updateConstanciaData(this.constancia.id, updatedData);
        
        this.utilsSvc.presentToast({
          message: 'Constancia actualizada correctamente',
          color: 'success',
          duration: 2500,
          position: 'middle'
        });

        this.dismissModal(true);
      } catch (error) {
        console.error('Error al actualizar constancia:', error);
        this.utilsSvc.presentToast({
          message: 'Error al actualizar la constancia',
          color: 'danger',
          duration: 2500,
          position: 'middle'
        });
      } finally {
        loading.dismiss();
      }
    }
  }

  dismissModal(updated = false) {
    this.modalController.dismiss({
      updated
    });
  }

  // Helper para mensajes de error
  getErrorMessage(fieldName: string): string {
    const field = this.form.get(fieldName);
    
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) {
      return 'Este campo es requerido';
    }

    if (field.errors['minlength']) {
      return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
    }

    return '';
  }
}