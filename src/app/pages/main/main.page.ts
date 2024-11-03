// main.page.ts
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user.models';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  planilleroPages = [
    { title: 'Home', url: '/main/home', icon: 'home-outline' },
    { title: 'Constancias', url: '/main/user-constancia', icon: 'document-outline' },
    { title: 'Administración Constancias', url: '/main/admin-constancia', icon: 'ribbon-outline' },
    { title: 'Perfil', url: '/main/profile', icon: 'person-outline' },

  ];
  admin = [
    { title: 'Home', url: '/main/home', icon: 'home-outline' },

    { title: 'Panel Administrativo', url: '/main/panel', icon: 'people-outline' },
    { title: 'Constancias', url: '/main/user-constancia', icon: 'document-outline' },
    { title: 'Administración Constancias', url: '/main/admin-constancia', icon: 'ribbon-outline' },
    { title: 'Perfil', url: '/main/profile', icon: 'person-outline' },

  ]
  // Páginas específicas para usuarios normales
  userPages = [
    { title: 'Home', url: '/main/home', icon: 'home-outline' },
    { title: 'Constancias', url: '/main/user-constancia', icon: 'document-outline' },
    { title: 'Perfil', url: '/main/profile', icon: 'person-outline' },

  ];

  router = inject(Router);
  firebaseSvc = inject(FirebaseService);
  utilsSvc = inject(UtilsService);
  currentPath: string = '';

  ngOnInit() {
    this.router.events.subscribe((event: any) => {
      if (event?.url) this.currentPath = event.url;
    });
  }
  // Obtener las páginas según el rol del usuario
  get pages() {
    const user = this.user();
    switch (user?.role) {
      case 'admin':
        return [...this.admin];
      case 'planillero':
        return [...this.planilleroPages];
      default:
        return [...this.userPages];
    }
  }

  user(): User {
    return this.utilsSvc.getFromLocalStorage('user');
  }

  // Obtener el rol para mostrar
  getRoleDisplay(): string {
    const role = this.user()?.role;
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'planillero':
        return 'Planillero';
      default:
        return 'Usuario';
    }
  }

  //======= Cerrar Sesión =========
  signOut() {
    this.firebaseSvc.signOut();
  }

}