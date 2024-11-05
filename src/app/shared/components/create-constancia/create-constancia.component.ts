import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Constancia } from 'src/app/models/constancia.model';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { User } from 'src/app/models/user.models';

@Component({
  selector: 'app-create-constancia',
  templateUrl: './create-constancia.component.html',
  styleUrls: ['./create-constancia.component.scss'],
})
export class CreateConstanciaComponent implements OnInit {
  form: FormGroup;
  user = {} as User;

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
  ) { }

  ngOnInit() {
    this.user = this.utilsSvc.getFromLocalStorage('user');
    this.initForm();
  }

  private initForm() {
    this.form = this.formBuilder.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      apellidos: ['', [Validators.required, Validators.minLength(3)]],
      documento: ['', [Validators.required, Validators.minLength(8)]],
      tipo: ['', [Validators.required]],
      motivo: ['', [Validators.required, Validators.minLength(10)]],
      estado: ['pendiente'],
      createdAt: [new Date().toISOString()],
      updatedAt: [new Date().toISOString()],
      userId: [this.user.uid],
      userEmail: [this.user.email]
    });
  }

  async onSubmit() {
    if (this.form.valid) {
      const loading = await this.utilsSvc.loading();

      try {
        await loading.present();

        let path = `users/${this.user.uid}/constancia`;

        await this.firebaseSvc.addDocument(path, this.form.value);

        this.utilsSvc.presentToast({
          message: 'Constancia creada exitosamente',
          duration: 1500,
          color: 'success',
          position: 'middle',
          icon: 'checkmark-circle-outline'
        });

        this.modalController.dismiss({ created: true });

      } catch (error) {
        console.error('Error al crear constancia:', error);

        this.utilsSvc.presentToast({
          message: error.message,
          duration: 2500,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
      } finally {
        loading.dismiss();
      }
    }
  }

  dismissModal() {
    this.modalController.dismiss({
      created: false
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