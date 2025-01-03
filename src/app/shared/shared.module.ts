import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { CustomInputComponent } from './components/custom-input/custom-input.component';
import { LogoComponent } from './components/logo/logo.component';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AddUpdateProductComponent } from './components/add-update-product/add-update-product.component';
import { AddUpdateUserComponent } from './components/add-update-user/add-update-user.component';
import { ConstanciaDetailComponent } from './components/constancia-detail/constancia-detail.component';
import { EditConstanciaComponent } from './components/edit-constancia/edit-constancia.component';
import { CreateConstanciaComponent } from './components/create-constancia/create-constancia.component';

@NgModule({
  declarations: [
    HeaderComponent,
    CustomInputComponent,
    LogoComponent,
    AddUpdateProductComponent,
    AddUpdateUserComponent,
    ConstanciaDetailComponent,
    EditConstanciaComponent,
    CreateConstanciaComponent

  ],
  exports: [
    HeaderComponent,
    CustomInputComponent,
    LogoComponent,
    ReactiveFormsModule,
    AddUpdateProductComponent,
    ConstanciaDetailComponent,
    CreateConstanciaComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    FormsModule
  ]
})
export class SharedModule { }
