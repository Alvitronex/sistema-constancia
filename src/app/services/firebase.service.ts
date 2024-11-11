import { inject, Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, updateEmail as firebaseUpdateEmail, reauthenticateWithCredential, EmailAuthProvider, AuthErrorCodes, updateEmail } from 'firebase/auth';
import { User } from '../models/user.models';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { getFirestore, setDoc, doc, getDoc, addDoc, collection, collectionData, query, updateDoc, deleteDoc, where, orderBy, getDocs } from '@angular/fire/firestore';
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
  // Añadir al inicio de la clase FirebaseService
  months = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];
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
  
  async getAllConstancias(): Promise<Constancia[]> {
    try {
      const constancias: Constancia[] = [];
      const usersRef = collection(getFirestore(), 'users');
      const usersSnap = await getDocs(usersRef);

      for (const userDoc of usersSnap.docs) {
        const constanciasRef = collection(getFirestore(), `users/${userDoc.id}/constancia`);
        const constanciasSnap = await getDocs(constanciasRef);

        constanciasSnap.docs.forEach(doc => {
          const data: any = doc.data();

          // Manejar createdAt con operador de acceso seguro
          const createdAt = data?.createdAt ?
            (typeof data.createdAt === 'string' ?
              data.createdAt :
              data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString()
            ) : new Date().toISOString();

          // Manejar updatedAt con operador de acceso seguro
          const updatedAt = data?.updatedAt ?
            (typeof data.updatedAt === 'string' ?
              data.updatedAt :
              data.updatedAt?.toDate?.()?.toISOString?.() || createdAt
            ) : createdAt;

          // Crear objeto constancia con acceso seguro a propiedades
          const constancia: Constancia = {
            id: doc.id,
            nombre: data?.nombre || '',
            apellidos: data?.apellidos || '',
            documento: data?.documento || '',
            tipo: data?.tipo || '',
            motivo: data?.motivo || '',
            estado: data?.estado || 'pendiente',
            createdAt,
            updatedAt,
            userId: userDoc.id,
            userEmail: data?.userEmail || ''
          };

          constancias.push(constancia);
        });
      }

      // Ordenar por fecha de creación descendente
      return constancias.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    } catch (error) {
      console.error('Error getting all constancias:', error);
      return [];
    }
  }
  private formatFirestoreDate(date: any): string {
    if (!date) return new Date().toISOString();
    if (typeof date === 'string') return date;
    if (date.toDate) return date.toDate().toISOString();
    return new Date().toISOString();
  }
  async getConstanciasStats(year: number, month: string = 'all') {
    try {
      const constancias = await this.getAllConstancias();
      if (!constancias || constancias.length === 0) {
        return {
          aprobadas: 0,
          rechazadas: 0,
          pendientes: 0,
          porMes: []
        };
      }

      // Inicializar estadísticas
      const stats = {
        aprobadas: 0,
        rechazadas: 0,
        pendientes: 0,
        porMes: []
      };

      // Filtrar constancias por año
      const filteredConstancias = constancias.filter(c => {
        const fecha = new Date(c.createdAt);
        if (month === 'all') {
          return fecha.getFullYear() === year;
        }
        return fecha.getFullYear() === year && (fecha.getMonth() + 1) === parseInt(month);
      });

      // Si no hay constancias para el período seleccionado, retornar stats con ceros
      if (filteredConstancias.length === 0) {
        return stats;
      }

      // Calcular totales
      filteredConstancias.forEach(c => {
        switch (c.estado) {
          case 'aprobada':
            stats.aprobadas++;
            break;
          case 'rechazada':
            stats.rechazadas++;
            break;
          case 'pendiente':
            stats.pendientes++;
            break;
        }
      });

      // Procesar datos mensuales solo si se solicitan todos los meses
      if (month === 'all') {
        const constanciasPorMes = new Map();

        // Inicializar los meses que tienen datos
        filteredConstancias.forEach(c => {
          const fecha = new Date(c.createdAt);
          const mes = fecha.getMonth();
          if (!constanciasPorMes.has(mes)) {
            constanciasPorMes.set(mes, {
              aprobadas: 0,
              rechazadas: 0,
              pendientes: 0
            });
          }

          const mesStats = constanciasPorMes.get(mes);
          switch (c.estado) {
            case 'aprobada':
              mesStats.aprobadas++;
              break;
            case 'rechazada':
              mesStats.rechazadas++;
              break;
            case 'pendiente':
              mesStats.pendientes++;
              break;
          }
        });

        // Convertir el Map a array solo para los meses con datos
        // En el método getConstanciasStats
        stats.porMes = Array.from(constanciasPorMes.entries())
          .map(([mes, stats]) => ({
            mes: this.getNombreMes(parseInt(mes)),
            ...stats
          }))
          .sort((a, b) => {
            const meses = [
              'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
              'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            return meses.indexOf(a.mes) - meses.indexOf(b.mes);
          });
      }

      return stats;

    } catch (error) {
      console.error('Error getting constancias stats:', error);
      // Retornar estadísticas vacías en caso de error
      return {
        aprobadas: 0,
        rechazadas: 0,
        pendientes: 0,
        porMes: []
      };
    }
  }

  private getNombreMes(mes: number): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes];
  }

}
