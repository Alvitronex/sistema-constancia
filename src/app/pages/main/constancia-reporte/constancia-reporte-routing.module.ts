import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConstanciaReportePage } from './constancia-reporte.page';

const routes: Routes = [
  {
    path: '',
    component: ConstanciaReportePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConstanciaReportePageRoutingModule {}
