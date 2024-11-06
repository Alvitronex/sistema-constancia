import { inject, Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree } from "@angular/router";
import { Observable } from "rxjs";
import { FirebaseService } from "../services/firebase.service";
import { UtilsService } from "../services/utils.service";

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  firebaseSvc = inject(FirebaseService);
  utilsSvc = inject(UtilsService)

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    let user = this.utilsSvc.getFromLocalStorage('user');

    return new Promise((resolve) => {
      this.firebaseSvc.getAuth().onAuthStateChanged((auth) => {
        if(auth) {
          if (user) {
            // Si es admin, permitir acceso a todo
            if (user.role === 'admin') {
              resolve(true);
              return;
            }

            // Para otros roles, verificar permisos específicos
            if (route.data['requiredRole']) {
              if (user.role === route.data['requiredRole']) {
                resolve(true);
              } else {
                this.utilsSvc.routerLink('/main/user-constancia');
                this.utilsSvc.presentToast({
                  message: 'No tienes permisos para acceder a esta sección',
                  duration: 2500,
                  color: 'warning',
                  position: 'middle'
                });
                resolve(false);
              }
            } else {
              resolve(true);
            }
          }
        } else {
          this.firebaseSvc.signOut();
          resolve(false);
        }
      })
    });
  }
}