import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ConstanciaReportePageRoutingModule } from './constancia-reporte-routing.module';

import { ConstanciaReportePage } from './constancia-reporte.page';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ConstanciaReportePageRoutingModule,
    SharedModule
  ],
  declarations: [ConstanciaReportePage]
})
export class ConstanciaReportePageModule {}
