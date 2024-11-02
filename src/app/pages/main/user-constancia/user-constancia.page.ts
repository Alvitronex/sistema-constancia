import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-user-constancia',
  templateUrl: './user-constancia.page.html',
  styleUrls: ['./user-constancia.page.scss'],
})
export class UserConstanciaPage implements OnInit {
  form: FormGroup;
  loading = false;

  tiposConstancia = [
    { value: 'LABORAL', label: 'Laboral' },
    { value: 'ESTUDIOS', label: 'Estudios' },
    { value: 'RESIDENCIA', label: 'Residencia' }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private firebaseSvc: FirebaseService,
    private utilsSvc: UtilsService
  ) {
    this.form = this.formBuilder.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      apellidos: ['', [Validators.required, Validators.minLength(3)]],
      documento: ['', [Validators.required, Validators.minLength(8)]],
      tipo: ['', [Validators.required]],
      motivo: ['', [Validators.required, Validators.minLength(10)]],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit() {
    if (!this.firebaseSvc.getAuth().currentUser) {
      this.utilsSvc.routerLink('/auth');
    }
  }

  async onSubmit() {
    if (this.form.valid) {
      try {
        const loading = await this.utilsSvc.loading();
        await loading.present();

        const user = this.firebaseSvc.getAuth().currentUser;

        const constancia = {
          ...this.form.value,
          estado: 'pendiente',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId: user.uid,
          userEmail: user.email
        };

        await this.firebaseSvc.createConstancia(constancia);

        this.utilsSvc.presentToast({
          message: 'Constancia registrada exitosamente',
          duration: 2500,
          color: 'success',
          position: 'middle'
        });

        this.form.reset();
        this.utilsSvc.routerLink('/admin-constancia');

        loading.dismiss();
      } catch (error) {
        console.error('Error al registrar constancia:', error);
        this.utilsSvc.presentToast({
          message: 'Error al registrar la constancia',
          duration: 2500,
          color: 'danger',
          position: 'middle'
        });
      }
    } else {
      this.utilsSvc.presentToast({
        message: 'Por favor, complete todos los campos correctamente',
        duration: 2500,
        color: 'warning',
        position: 'middle'
      });
    }
  }

  // Helper para mensajes de error
  getErrorMessage(fieldName: string): string {
    const field = this.form.get(fieldName);

    if (!field || !field.errors) return '';

    if (field.errors['required']) {
      return 'Este campo es requerido';
    }

    if (field.errors['minlength']) {
      return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
    }

    if (field.errors['email']) {
      return 'Email inválido';
    }

    return '';
  }
}