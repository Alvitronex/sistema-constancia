import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { NoAuthGuard } from './guards/no-auth.guard';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.module').then(m => m.AuthPageModule), canActivate: [NoAuthGuard]
  },
  {
    path: 'main',
    loadChildren: () => import('./pages/main/main.module').then(m => m.MainPageModule), canActivate: [AuthGuard]
  },
  // {
  //   path: 'panel',
  //   loadChildren: () => import('./pages/panel/panel.module').then(m => m.PanelPageModule),
  //   canActivate: [AuthGuard],
  //   data: { requiredRole: 'planillero' }
  // },
  // {
  //   path: 'admin-constancia',
  //   loadChildren: () => import('./pages/admin-constancia/admin-constancia.module').then(m => m.AdminConstanciaPageModule),
  //   canActivate: [AuthGuard],
  //   data: { requiredRole: 'planillero' }
  // },
  // {
  //   path: 'user-constancia',
  //   loadChildren: () => import('./pages/user-constancia/user-constancia.module').then(m => m.UserConstanciaPageModule),
  //   canActivate: [AuthGuard],
  //   data: { requiredRole: 'usuario' }
  // }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
