import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AdminConstanciaPageRoutingModule } from './admin-constancia-routing.module';
import { AdminConstanciaPage } from './admin-constancia.page';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AdminConstanciaPageRoutingModule,
    SharedModule,
    AdminConstanciaPageRoutingModule

  ],
  declarations: [AdminConstanciaPage]
})
export class AdminConstanciaPageModule { }
