import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController } from '@ionic/angular';
import { User } from 'src/app/models/user.models';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-add-update-user',
  templateUrl: './add-update-user.component.html',
  styleUrls: ['./add-update-user.component.scss'],
})
export class AddUpdateUserComponent implements OnInit {
  @Input() user: User;
  form: FormGroup;
  imageUrl: string = '';
  currentUser: User;

  roles = [
    { id: 'usuario', name: 'Usuario' },
    { id: 'planillero', name: 'Planillero' },
    { id: 'admin', name: 'Administrador' }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private firebaseSvc: FirebaseService,
    public utilsSvc: UtilsService,
    private alertController: AlertController
  ) {
    this.currentUser = this.utilsSvc.getFromLocalStorage('user');
  }

  ngOnInit() {
    this.initForm();
    if (this.user) {
      this.imageUrl = this.user.image || '';
    }
  }

  isCurrentUser(): boolean {
    return this.currentUser && this.currentUser.uid === this.user?.uid;
  }

  initForm() {
    this.form = this.formBuilder.group({
      uid: [this.user?.uid || ''],
      email: [{
        value: this.user?.email || '',
        disabled: this.isCurrentUser() // Solo deshabilitar si es el usuario actual
      }, [Validators.required, Validators.email]],
      password: ['', this.user ? [] : [Validators.required]],
      name: [this.user?.name || '', [Validators.required, Validators.minLength(4)]],
      role: [this.user?.role || '', [Validators.required]],
      image: [this.user?.image || '']
    });
  }

  // async showCurrentUserEmailInfo() {
  //   if (this.isCurrentUser()) {
  //     const alert = await this.alertController.create({
  //       header: 'Cambio de Correo Electrónico',
  //       message: 'Por razones de seguridad, para cambiar tu propio correo electrónico debes cerrar sesión y usar la opción "¿Olvidaste tu contraseña?" en la página de inicio de sesión.',
  //       buttons: ['Entendido'],
  //       mode: 'ios'
  //     });
  //     await alert.present();
  //   }
  // }

  // Método para tomar/seleccionar imagen
  async takeImage() {
    try {
      const dataUrl = (await this.utilsSvc.takePicture('Imagen de Usuario')).dataUrl;
      this.imageUrl = dataUrl;
      this.form.patchValue({ image: dataUrl });
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      this.utilsSvc.presentToast({
        message: 'Error al seleccionar la imagen',
        duration: 2500,
        color: 'danger',
        position: 'middle',
        mode: 'ios'
      });
    }
  }

  async submit() {
    if (this.form.valid) {
      const loading = await this.utilsSvc.loading();

      try {
        await loading.present();
        let userData = { ...this.form.getRawValue() };

        if (this.imageUrl && this.imageUrl !== this.user?.image) {
          const imagePath = `users/${userData.uid || 'temp'}/profile`;
          userData.image = await this.firebaseSvc.uploadImage(imagePath, this.imageUrl);
        }

        if (this.user) {
          const path = `users/${this.user.uid}`;
          delete userData.password;

          // Si no es el usuario actual, permitir actualización de email
          const emailChanged = !this.isCurrentUser() && this.user.email !== userData.email;

          if (emailChanged) {
            // Verificar si el nuevo email ya está en uso
            try {
              const emailExists = await this.firebaseSvc.checkEmailExists(userData.email);
              if (emailExists) {
                throw new Error('El correo electrónico ya está en uso');
              }
            } catch (error) {
              this.utilsSvc.presentToast({
                message: error.message,
                duration: 2500,
                color: 'danger',
                position: 'middle',
                mode: 'ios'
              });
              return;
            }
          } else {
            delete userData.email;
          }

          await this.firebaseSvc.updateDocument(path, userData);

          if (this.isCurrentUser()) {
            this.utilsSvc.saveInLocalStorage('user', { ...this.currentUser, ...userData });
          }

          this.utilsSvc.dismissModal({ success: true });
          this.utilsSvc.presentToast({
            message: 'Usuario actualizado exitosamente',
            duration: 1500,
            color: 'success',
            position: 'middle',
            mode: 'ios'
          });
        } else {
          // Crear nuevo usuario
          const res = await this.firebaseSvc.signUp(userData as User);
          await this.firebaseSvc.updateUser(userData.name);

          userData.uid = res.user.uid;
          const path = `users/${userData.uid}`;
          delete userData.password;

          await this.firebaseSvc.setDocument(path, userData);
          this.utilsSvc.dismissModal({ success: true });
          this.utilsSvc.presentToast({
            message: 'Usuario creado exitosamente',
            duration: 1500,
            color: 'success',
            position: 'middle',
            mode: 'ios'
          });
        }
      } catch (error) {
        console.error('Error:', error);
        this.utilsSvc.presentToast({
          message: error.message || 'Error al procesar la solicitud',
          duration: 2500,
          color: 'danger',
          position: 'middle',
          mode: 'ios'
        });
      } finally {
        loading.dismiss();
      }
    }
  }

  getErrorMessage(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control || !control.errors || !control.touched) return '';

    const errors = control.errors;
    if (errors['required']) return 'Este campo es requerido';
    if (errors['email']) return 'Correo electrónico inválido';
    if (errors['minlength']) {
      return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    }
    return '';
  }
}