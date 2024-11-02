import { inject, Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { User } from '../models/user.models';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { getFirestore, setDoc, doc, getDoc, addDoc, collection, collectionData, query, updateDoc, deleteDoc, where, orderBy } from '@angular/fire/firestore';
import { UtilsService } from './utils.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { getStorage, uploadBytes, ref, getDownloadURL, uploadString, deleteObject } from 'firebase/storage';
import { Constancia } from '../models/constancia.model';
import { Observable } from 'rxjs';

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
}
