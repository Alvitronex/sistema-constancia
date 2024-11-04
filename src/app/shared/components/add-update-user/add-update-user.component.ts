import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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

  roles = [
    { id: 'usuario', name: 'Usuario' },
    { id: 'planillero', name: 'Planillero' },
    { id: 'admin', name: 'Administrador' }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private firebaseSvc: FirebaseService,
    public utilsSvc: UtilsService
  ) { }

  ngOnInit() {
    this.initForm();
    if (this.user) {
      this.imageUrl = this.user.image || '';
    }
  }

  // Verifica si el usuario que se está editando es el usuario actual
  isCurrentUser(): boolean {
    const currentUser = this.utilsSvc.getFromLocalStorage('user');
    return currentUser && currentUser.uid === this.user?.uid;
  }

  initForm() {
    this.form = this.formBuilder.group({
      uid: [this.user?.uid || ''],
      email: [this.user?.email || '', [Validators.required, Validators.email]],
      password: ['', this.user ? [] : [Validators.required]], // Solo requerido para nuevos usuarios
      name: [this.user?.name || '', [Validators.required, Validators.minLength(4)]],
      role: [this.user?.role || '', [Validators.required]],
      image: [this.user?.image || '']
    });

    // Deshabilitar email si estamos editando
    if (this.user) {
      this.form.get('email').disable();
    }
  }

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
        position: 'middle'
      });
    }
  }

  async submit() {
    if (this.form.valid) {
      const loading = await this.utilsSvc.loading();
      try {
        await loading.present();

        let userData = { ...this.form.value };

        // Si hay una nueva imagen, subirla primero
        if (this.imageUrl && this.imageUrl !== this.user?.image) {
          const imagePath = `users/${userData.uid || 'temp'}/profile`;
          userData.image = await this.firebaseSvc.uploadImage(imagePath, this.imageUrl);
        }

        if (this.user) {
          // Actualizar usuario existente
          const path = `users/${this.user.uid}`;
          delete userData.password;
          delete userData.email;

          await this.firebaseSvc.updateDocument(path, userData);

          // Si es el usuario actual, actualizar localStorage
          if (this.isCurrentUser()) {
            this.utilsSvc.updateCurrentUser(userData);
          }

          this.utilsSvc.dismissModal({ success: true });

          this.utilsSvc.presentToast({
            message: 'Usuario actualizado exitosamente',
            duration: 1500,
            color: 'success',
            position: 'middle'
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
            position: 'middle'
          });
        }

      } catch (error) {
        console.error('Error:', error);
        this.utilsSvc.presentToast({
          message: error.message,
          duration: 2500,
          color: 'danger',
          position: 'middle'
        });
      } finally {
        loading.dismiss();
      }
    }
  }
  // Helper para mensajes de error
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