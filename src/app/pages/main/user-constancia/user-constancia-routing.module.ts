import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { UserConstanciaPage } from './user-constancia.page';

const routes: Routes = [
  {
    path: '',
    component: UserConstanciaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserConstanciaPageRoutingModule {}
