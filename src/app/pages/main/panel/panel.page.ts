import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { User } from 'src/app/models/user.models';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { AddUpdateUserComponent } from 'src/app/shared/components/add-update-user/add-update-user.component';
import { orderBy, where } from 'firebase/firestore';

@Component({
  selector: 'app-panel',
  templateUrl: './panel.page.html',
  styleUrls: ['./panel.page.scss'],
})
export class PanelPage implements OnInit {

  form = new FormGroup({
    uid: new FormControl(''),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
    name: new FormControl('', [Validators.required, Validators.minLength(4)]),
  });

  firebaseSvc = inject(FirebaseService);
  utilsSvc = inject(UtilsService);
  displayedUsers: User[] = [];
  users: User[] = [];

  pageSize: number = 10;
  currentPage: number = 1;
  totalPages: number = 1;
  pages: number[] = [];
  loading: boolean = false;

  user(): User {
    return this.utilsSvc.getFromLocalStorage('user');
  }
  ngOnInit() {
    this.getUsers();
  }

  ionViewWillEnter() {
    this.getUsers();
  }

  doRefresh(event) {
    setTimeout(() => {
      this.getUsers();
      event.target.complete();
    }, 1000);
  }
  getUsers() {
    let path = `users`;
    // this.loading = true;

    let query = [orderBy('name', 'asc')];

    this.firebaseSvc.getCollectionData(path, query).subscribe({
      next: (res: any) => {
        this.users = res;
        this.totalPages = Math.ceil(this.users.length / this.pageSize);
        this.updateDisplayedUsers();
        this.updatePagination();
        this.loading = false;
      }
    });
  }


  updateDisplayedUsers() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.displayedUsers = this.users.slice(start, end);
  }

  updatePagination() {
    const totalPages = Math.ceil(this.users.length / this.pageSize);
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    this.pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateDisplayedUsers();
      this.updatePagination();
    }
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }


  async submit() {
    if (this.form.valid) {
      const loading = await this.utilsSvc.loading();
      await loading.present();

      try {
        const auth = getAuth();
        const userCredential = await createUserWithEmailAndPassword(auth, this.form.value.email, this.form.value.password);
        const newUser = userCredential.user;

        // Update the user's display name
        await updateProfile(newUser, { displayName: this.form.value.name });

        // Set the UID in the form
        this.form.controls.uid.setValue(newUser.uid);

        // Set user info in Firestore
        await this.setUserInfo(newUser.uid);

        this.utilsSvc.presentToast({
          message: 'Usuario creado exitosamente',
          duration: 2500,
          color: 'success',
          position: 'middle',
          icon: 'checkmark-circle-outline'
        });

        // Reset the form
        this.form.reset();

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
  }


  async addUpdateUser(user?: User) {

    let success = await this.utilsSvc.presentModal({
      component: AddUpdateUserComponent,
      cssClass: 'add-update-modal',
      componentProps: { user }
    })

    if (success) this.getUsers();
  }

  async setUserInfo(uid: string) {
    if (this.form.valid) {
      const db = getFirestore();
      const userDocRef = doc(db, `users/${uid}`);

      const userData = {
        uid: uid,
        email: this.form.value.email,
        name: this.form.value.name,
      };

      try {
        await setDoc(userDocRef, userData);
      } catch (error) {
        console.error("Error adding document: ", error);
        throw error;
      }
    }
  }
}