import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Constancia } from 'src/app/models/constancia.model';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-constancia-detail',
  templateUrl: './constancia-detail.component.html',
  styleUrls: ['./constancia-detail.component.scss'],
})
export class ConstanciaDetailComponent {

  @Input() constancia: Constancia;

  constructor(
    private utilsSvc: UtilsService,
    private modalController: ModalController
  ) { }

  dismissModal() {
    this.modalController.dismiss();
  }
}
