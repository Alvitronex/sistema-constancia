import { inject, Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, updateEmail as firebaseUpdateEmail, reauthenticateWithCredential, EmailAuthProvider, AuthErrorCodes, updateEmail } from 'firebase/auth';
import { User } from '../models/user.models';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { getFirestore, setDoc, doc, getDoc, addDoc, collection, collectionData, query, updateDoc, deleteDoc, where, orderBy } from '@angular/fire/firestore';
import { UtilsService } from './utils.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { getStorage, uploadBytes, ref, getDownloadURL, uploadString, deleteObject } from 'firebase/storage';
import { Constancia } from '../models/constancia.model';
import { Observable } from 'rxjs';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';


@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  auth = inject(AngularFireAuth);
  firestore = inject(AngularFirestore);
  storage = inject(AngularFireStorage);
  utilsSvc = inject(UtilsService);

  // ========================== Autenticación ==========================
  getAuth() {
    return getAuth();
  }

  // ======= Acceder =========
  signIn(user: User) {
    return signInWithEmailAndPassword(getAuth(), user.email, user.password);
  }

  // ======= Crear Usuario =========
  signUp(user: User) {
    return createUserWithEmailAndPassword(getAuth(), user.email, user.password);
  }

  // ======= Actualizar usuario =========
  updateUser(displayName: string) {
    return updateProfile(getAuth().currentUser, { displayName });
  }

  // ======= Enviar email para restablecer contraseña =========
  sendRecoveryEmail(email: string) {
    return sendPasswordResetEmail(getAuth(), email);
  }

  // ======= Cerrar Sesión =========
  signOut() {
    getAuth().signOut();
    localStorage.removeItem('user');
    this.utilsSvc.routerLink('/auth');
  }

  // ====================== Base de Datos ======================

  // ======= Obtener documentos de una coleccion =========
  getCollectionData(path: string, collectionQuery?: any) {
    const ref = collection(getFirestore(), path);
    return collectionData(query(ref, ...collectionQuery), { idField: 'id' });
  }

  // ======= Setear un documento =========
  setDocument(path: string, data: any) {
    return setDoc(doc(getFirestore(), path), data);
  }

  // ======= Actualizar un documento =========
  updateDocument(path: string, data: any) {
    return updateDoc(doc(getFirestore(), path), data);
  }


  // ======= Eliminar un documento =========
  deleteDocument(path: string) {
    return deleteDoc(doc(getFirestore(), path));
  }

  // ========= Obtener un documento =========
  async getDocument(path: string) {
    return (await getDoc(doc(getFirestore(), path))).data();
  }

  // ========= Agregar un documento =========
  addDocument(path: string, data: any) {
    return addDoc(collection(getFirestore(), path), data);
  }

  // ====================== Almacenamiento ======================

  // ======= Subir imagen =========
  async uploadImage(path: string, data_url: string) {
    return uploadString(ref(getStorage(), path), data_url, 'data_url').then(() => {
      return getDownloadURL(ref(getStorage(), path));
    })
  }

  // Obtener ruta de la imagen con su url ======
  async getFilePath(url: string) {
    return ref(getStorage(), url).fullPath
  }

  //======= Eliminar archivo ========
  deleteFile(path: string) {
    return + deleteObject(ref(getStorage(), path));
  }
  // ======= Autenticación y Email =======
  async reauthenticateUser(email: string, password: string): Promise<boolean> {
    try {
      const currentUser = await this.auth.currentUser;
      if (!currentUser) {
        throw new Error('No hay usuario autenticado');
      }

      const credentials = firebase.auth.EmailAuthProvider.credential(
        email,
        password
      );

      await currentUser.reauthenticateWithCredential(credentials);
      return true;
    } catch (error) {
      console.error('Error en reautenticación:', error);
      throw error;
    }
  }



  async reauthenticateAndUpdateEmail(currentEmail: string, password: string, newEmail: string): Promise<void> {
    try {
      const user = await this.auth.currentUser;
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      // Crear credenciales usando la API de Firebase Compat
      const credential = await firebase.auth.EmailAuthProvider.credential(
        currentEmail,
        password
      );

      // Primero reautenticar
      try {
        await user.reauthenticateWithCredential(credential);
      } catch (error: any) {
        console.error('Error en reautenticación:', error);
        if (error.code === 'auth/wrong-password') {
          throw new Error('La contraseña ingresada es incorrecta');
        } else if (error.code === 'auth/invalid-credential') {
          // Intentar reautenticar de otra manera
          await this.auth.signInWithEmailAndPassword(currentEmail, password);
        } else {
          throw error;
        }
      }

      // Verificar el nuevo email
      const methods = await this.auth.fetchSignInMethodsForEmail(newEmail);
      if (methods.length > 0) {
        throw new Error('El correo electrónico ya está en uso');
      }

      // Actualizar el email
      await user.updateEmail(newEmail);

      return;
    } catch (error: any) {
      console.error('Error en el proceso:', error);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('El correo electrónico ya está en uso');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('El correo electrónico no es válido');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Por favor, vuelve a iniciar sesión');
      } else if (error.message) {
        throw new Error(error.message);
      }
      throw new Error('Error al actualizar el email');
    }
  }

  // Método auxiliar para verificar la sesión actual
  async verifyCurrentSession(email: string, password: string): Promise<boolean> {
    try {
      await this.auth.signInWithEmailAndPassword(email, password);
      return true;
    } catch (error) {
      console.error('Error al verificar sesión:', error);
      return false;
    }
  }
  async updateUserEmail(newEmail: string): Promise<void> {
    try {
      const currentUser = await this.auth.currentUser;
      if (!currentUser) {
        throw new Error('No hay usuario autenticado');
      }
      await currentUser.updateEmail(newEmail);
    } catch (error) {
      console.error('Error al actualizar email:', error);
      throw error;
    }
  }

  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const methods = await this.auth.fetchSignInMethodsForEmail(email);
      return methods.length > 0;
    } catch (error) {
      console.error('Error al verificar email:', error);
      throw new Error('Error al verificar disponibilidad del correo electrónico');
    }
  }
  // ====================== Constancias ======================

  // ======= Crear constancia =========
  async createConstancia(data: Constancia) {
    try {
      const path = 'constancias';
      const response = await this.addDocument(path, data);
      return response;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  // ======= Obtener constancias del usuario =========
  getConstanciasUser(userId: string) {
    const path = 'constancias';
    const dataQuery = [
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    ];
    return this.getCollectionData(path, dataQuery) as Observable<Constancia[]>;
  }
  // ======= Actualizar estado de constancia =========
  updateConstanciaStatus(constanciaId: string, estado: string) {
    const path = `constancias/${constanciaId}`;
    return this.updateDocument(path, {
      estado,
      updatedAt: new Date().toISOString()
    });
  }

  // ======= Obtener una constancia específica =========
  async getConstancia(constanciaId: string) {
    const path = `constancias/${constanciaId}`;
    return await this.getDocument(path) as Constancia;
  }
  async deleteConstancia(constanciaId: string) {
    try {
      const path = `constancias/${constanciaId}`;
      await this.deleteDocument(path);
      return true;
    } catch (error) {
      console.error('Error al eliminar constancia:', error);
      throw error;
    }
  }
  async updateConstanciaData(constanciaId: string, data: Partial<Constancia>) {
    try {
      const path = `constancias/${constanciaId}`;
      await this.updateDocument(path, data);
      return true;
    } catch (error) {
      console.error('Error al actualizar constancia:', error);
      throw error;
    }
  }
  async sendEmailWithAttachment(emailData: {
    to: string;
    subject: string;
    html: string;
    attachments: Array<{
      filename: string;
      content: string;
      encoding: string;
      type: string;
    }>;
  }): Promise<void> {
    try {
      // Aquí implementarías la lógica de envío de correo
      // Puedes usar Firebase Cloud Functions o un servicio de correo externo

      // Por ahora, usaremos un enfoque simple con EmailJS o similar
      const emailJsData = {
        service_id: 'your_service_id',  // Reemplazar con tu ID de servicio
        template_id: 'your_template_id', // Reemplazar con tu ID de template
        user_id: 'your_user_id',        // Reemplazar con tu ID de usuario
        template_params: {
          to_email: emailData.to,
          subject: emailData.subject,
          message_html: emailData.html,
          attachment: emailData.attachments[0].content
        }
      };

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailJsData)
      });

      if (!response.ok) {
        throw new Error('Error al enviar el correo');
      }
    } catch (error) {
      console.error('Error en sendEmailWithAttachment:', error);
      throw error;
    }
  }
}
