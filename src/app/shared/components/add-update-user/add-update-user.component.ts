import { Component, inject, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

  form = new FormGroup({
    uid: new FormControl(''),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    name: new FormControl('', [Validators.required, Validators.minLength(4)]),
    image: new FormControl('')
  });

  firebaseSvc = inject(FirebaseService);
  utilsSvc = inject(UtilsService);
  router = inject(Router);

  selectedImage: File | null = null;
  imagePreview: string | ArrayBuffer | null = null;

  ngOnInit() {
    if (this.user) {
      this.form.patchValue(this.user);
      this.form.controls.password.clearValidators();
      this.imagePreview = this.user.image || null;
    }
  }

  async submit() {
    if (this.form.valid) {
      if (this.user) this.updateUser();
      else this.createUser();
    }
  }

  async createUser() {
    const loading = await this.utilsSvc.loading();
    await loading.present();

    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, this.form.value.email, this.form.value.password);
      const newUser = userCredential.user;

      let imageUrl = '';
      if (this.selectedImage) {
        imageUrl = await this.uploadImage(newUser.uid);
      }

      await updateProfile(newUser, { displayName: this.form.value.name, photoURL: imageUrl });

      this.form.controls.uid.setValue(newUser.uid);

      await this.setUserInfo(newUser.uid, imageUrl);

      this.utilsSvc.dismissModal({ success: true });

      this.utilsSvc.presentToast({
        message: 'Usuario creado exitosamente',
        duration: 2500,
        color: 'success',
        position: 'middle',
        icon: 'checkmark-circle-outline'
      });

      this.router.navigate(['/panel']);
    } catch (error) {
      console.error(error);
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

  async updateUser() {
    const loading = await this.utilsSvc.loading();
    await loading.present();

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user) {
        let imageUrl = this.user.image || '';
        if (this.selectedImage) {
          imageUrl = await this.uploadImage(user.uid);
        }

        const updateData: any = { displayName: this.form.value.name };
        if (imageUrl) {
          updateData.photoURL = imageUrl;
        }

        await updateProfile(user, updateData);
        await this.setUserInfo(user.uid, imageUrl);

        this.utilsSvc.dismissModal({ success: true });

        this.utilsSvc.presentToast({
          message: 'Usuario actualizado exitosamente',
          duration: 2500,
          color: 'success',
          position: 'middle',
          icon: 'checkmark-circle-outline'
        });

        this.router.navigate(['/panel']);
      }
    } catch (error) {
      console.error(error);
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

  async setUserInfo(uid: string, imageUrl: string) {
    if (this.form.valid) {
      const db = getFirestore();
      const userDocRef = doc(db, `users/${uid}`);

      const userData: any = {
        uid: uid,
        email: this.form.value.email,
        name: this.form.value.name,
      };

      if (imageUrl) {
        userData.image = imageUrl;
      }

      try {
        await setDoc(userDocRef, userData, { merge: true });
      } catch (error) {
        console.error("Error adding document: ", error);
        throw error;
      }
    }
  }

  async uploadImage(uid: string): Promise<string> {
    if (!this.selectedImage) return '';

    const storage = getStorage();
    const storageRef = ref(storage, `user-images/${uid}/${Date.now()}_${this.selectedImage.name}`);

    try {
      const snapshot = await uploadBytes(storageRef, this.selectedImage);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image: ", error);
      throw error;
    }
  }

  onImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.selectedImage = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }
}