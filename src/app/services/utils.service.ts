import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, AlertOptions, LoadingController, ModalController, ModalOptions, ToastController, ToastOptions } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  loadingCtrl = inject(LoadingController);
  toasCtrl = inject(ToastController);
  modaCtrl = inject(ModalController);
  router = inject(Router);
  alertCrtl = inject(AlertController)

  

async takePicture(promptLabelHeader: string) {
  return  await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt,
    promptLabelHeader,
    promptLabelPhoto: ' Seleccionar una imagen',
    promptLabelPicture: 'Toma una foto'
  });

 
};

// ====== Alert ======
async presentAlert(opts?: AlertOptions) {
  const alert = await this.alertCrtl.create(opts);

  await alert.present();
}

  // ====== Loading ======
  loading(){
  return this.loadingCtrl.create({ spinner: 'crescent'})
  }

  // ====== Toast ======
  async presentToast(opts?: ToastOptions) {
    const toast = await this.toasCtrl.create(opts);
    toast.present();
  }

  // ====== Enruta a cualquier página disponible ======// 
  routerLink(url: string) {
    return this.router.navigateByUrl(url);
  }

  // ====== Guardar un elemento en localStorage ======
  saveInLocalStorage(key: string, value: any) {
    return localStorage.setItem(key, JSON.stringify(value));
  }

  // ====== Obtener un elemento de localStorage ======
  getFromLocalStorage(key: string) {
    return JSON.parse(localStorage.getItem(key));
  }


  // ================ Modal =================
  async presentModal(opts: ModalOptions) {
    const modal = await this.modaCtrl.create(opts);
    await modal.present();

    const { data } = await modal.onWillDismiss();
    if(data) return data;
  }

  dismissModal(data?: any) {
    return this.modaCtrl.dismiss(data);
  }

  // === PDF MAKEPDF ===


  
  pdfMake() {
    
    return (pdfMake as any).vfs = pdfFonts.pdfMake.vfs;
  }

 
}
