import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminConstanciaPage } from './admin-constancia.page';

const routes: Routes = [
  {
    path: '',
    component: AdminConstanciaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminConstanciaPageRoutingModule {}
