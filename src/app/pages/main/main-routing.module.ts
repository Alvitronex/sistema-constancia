import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MainPage } from './main.page';

const routes: Routes = [
  {
    path: '',
    component: MainPage,
    children: [

      {
        path: 'profile',
        loadChildren: () => import('./profile/profile.module').then(m => m.ProfilePageModule)
      }, {
        path: 'panel',
        loadChildren: () => import('./panel/panel.module').then(m => m.PanelPageModule)
      },
      {
        path: 'user-constancia',
        loadChildren: () => import('./user-constancia/user-constancia.module').then(m => m.UserConstanciaPageModule)
      },
      {
        path: 'admin-constancia',
        loadChildren: () => import('./admin-constancia/admin-constancia.module').then(m => m.AdminConstanciaPageModule)
      },
      {
        path: 'constancia-reporte',
        loadChildren: () => import('./constancia-reporte/constancia-reporte.module').then(m => m.ConstanciaReportePageModule)
      },

    ]
  },






];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MainPageRoutingModule { }
