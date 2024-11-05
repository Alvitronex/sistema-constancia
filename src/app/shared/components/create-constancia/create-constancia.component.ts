import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Constancia } from 'src/app/models/constancia.model';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-create-constancia',
  templateUrl: './create-constancia.component.html',
  styleUrls: ['./create-constancia.component.scss'],
})
export class CreateConstanciaComponent  implements OnInit {
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

  private initForm() {
    const user = this.utilsSvc.getFromLocalStorage('user');
    
    this.form = this.formBuilder.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      apellidos: ['', [Validators.required, Validators.minLength(3)]],
      documento: ['', [Validators.required, Validators.minLength(8)]],
      tipo: ['', [Validators.required]],
      motivo: ['', [Validators.required, Validators.minLength(10)]],
      estado: ['pendiente'],
      createdAt: [new Date().toISOString()],
      updatedAt: [new Date().toISOString()],
      userId: [user.uid],
      userEmail: [user.email]
    });
  }

  async onSubmit() {
    if (this.form.valid) {
      const loading = await this.utilsSvc.loading();
      try {
        await loading.present();
        
        await this.firebaseSvc.createConstancia(this.form.value);
        
        this.utilsSvc.presentToast({
          message: 'Constancia creada correctamente',
          color: 'success',
          duration: 2500,
          position: 'middle'
        });

        this.dismissModal(true);
      } catch (error) {
        console.error('Error al crear constancia:', error);
        this.utilsSvc.presentToast({
          message: 'Error al crear la constancia',
          color: 'danger',
          duration: 2500,
          position: 'middle'
        });
      } finally {
        loading.dismiss();
      }
    }
  }

  dismissModal(created = false) {
    this.modalController.dismiss({
      created
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
