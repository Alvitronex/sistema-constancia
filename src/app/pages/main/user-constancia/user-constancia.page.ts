import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, debounceTime, map, startWith } from 'rxjs/operators';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { Constancia } from 'src/app/models/constancia.model';
import { orderBy } from '@angular/fire/firestore';
import { ModalController } from '@ionic/angular';
import { ConstanciaDetailComponent } from 'src/app/shared/components/constancia-detail/constancia-detail.component';
import { CreateConstanciaComponent } from 'src/app/shared/components/create-constancia/create-constancia.component';
import * as pdfMake from 'pdfmake/build/pdfmake';

@Component({
  selector: 'app-user-constancia',
  templateUrl: './user-constancia.page.html',
  styleUrls: ['./user-constancia.page.scss'],
})
export class UserConstanciaPage implements OnInit, OnDestroy {
  constancias$: Observable<Constancia[]>;
  filteredConstancias$: Observable<Constancia[]>;
  loading = true;
  error = false;
  searchControl = new FormControl('');
  tipoControl = new FormControl('todos');
  estadoControl = new FormControl('todos');
  private destroy$ = new Subject<void>();
  paginatedConstancias: Constancia[] = [];
  pageSize: number = 8;
  currentPage: number = 1;
  totalPages: number = 1;
  pages: number[] = [];
  Math = Math;
  // Tipos de constancias disponibles
  tiposConstancia = [
    { value: 'todos', label: 'Todos' },
    { value: 'LABORAL', label: 'Laboral' },
    { value: 'ESTUDIOS', label: 'Estudios' },
    { value: 'RESIDENCIA', label: 'Residencia' }
  ];

  // Estados de constancias
  estadosConstancia = [
    { value: 'todos', label: 'Todos' },
    { value: 'pendiente', label: 'Pendiente', color: 'warning' },
    { value: 'aprobada', label: 'Aprobada', color: 'success' },
    { value: 'rechazada', label: 'Rechazada', color: 'danger' }
  ];

  constructor(
    private firebaseSvc: FirebaseService,
    private utilsSvc: UtilsService,
    private modalController: ModalController
  ) { }

  ngOnInit() {
    this.loadConstancias();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private filterConstancias(
    constancias: Constancia[],
    searchTerm: string,
    tipo: string,
    estado: string
  ): Constancia[] {
    const user = this.utilsSvc.getFromLocalStorage('user');
    return constancias.filter(constancia => {
      // Filtrar solo las constancias del usuario actual
      if (constancia.userId !== user.uid) return false;

      const searchString = [
        constancia.nombre,
        constancia.apellidos,
        constancia.documento
      ].join(' ').toLowerCase();

      const matchesSearch = searchString.includes(searchTerm.toLowerCase().trim());
      const matchesTipo = tipo === 'todos' || constancia.tipo === tipo;
      const matchesEstado = estado === 'todos' || constancia.estado === estado;

      return matchesSearch && matchesTipo && matchesEstado;
    });
  }

  loadConstancias() {
    try {
      const constanciasRef = this.firebaseSvc.getCollectionData(
        'constancias',
        [orderBy('createdAt', 'desc')]
      ) as Observable<Constancia[]>;

      this.filteredConstancias$ = combineLatest([
        constanciasRef,
        this.searchControl.valueChanges.pipe(startWith('')),
        this.tipoControl.valueChanges.pipe(startWith('todos')),
        this.estadoControl.valueChanges.pipe(startWith('todos'))
      ]).pipe(
        debounceTime(300),
        map(([constancias, searchTerm, tipo, estado]) => {
          const filtered = this.filterConstancias(constancias, searchTerm || '', tipo, estado);
          this.loading = false;
          return filtered;
        }),
        takeUntil(this.destroy$)
      );
    } catch (error) {
      console.error('Error loading constancias:', error);
      this.error = true;
      this.loading = false;
    }
  }

  async openConstanciaDetail(constancia: Constancia) {
    const modal = await this.modalController.create({
      component: ConstanciaDetailComponent,
      componentProps: { constancia }
    });
    return await modal.present();
  }

  async createConstancia() {
    const modal = await this.modalController.create({
      component: CreateConstanciaComponent,
      cssClass: 'modal-full-right-side'
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.created) {
      this.loadConstancias();
    }
  }

  async generatePDF(constancia: Constancia) {
    if (constancia.estado !== 'aprobada') {
      this.utilsSvc.presentToast({
        message: 'Solo se pueden generar PDF de constancias aprobadas',
        color: 'warning',
        duration: 2500,
        position: 'middle'
      });
      return;
    }

    const loading = await this.utilsSvc.loading();
    try {
      await loading.present();

      // Formatear la fecha actual
      const fechaEmision = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const docDefinition: any = {
        content: [
          {
            text: 'CONSTANCIA',
            style: 'header'
          },
          {
            text: '\nA QUIEN CORRESPONDA:',
            style: 'subheader'
          },
          {
            text: [
              '\nPor medio de la presente se hace constar que ',
              { text: `${constancia.nombre} ${constancia.apellidos}`, bold: true },
              ', identificado(a) con documento número ',
              { text: constancia.documento, bold: true },
              ', solicita una constancia de tipo ',
              { text: constancia.tipo.toLowerCase(), bold: true },
              ' por el siguiente motivo:\n\n'
            ]
          },
          {
            text: constancia.motivo,
            italics: true,
            margin: [20, 0, 20, 20]
          },
          {
            text: `\nFecha de emisión: ${fechaEmision}`,
            alignment: 'right',
            margin: [0, 20, 0, 40]
          },
          {
            text: '_______________________\nFirma Autorizada',
            alignment: 'center'
          }
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },
          subheader: {
            fontSize: 14,
            bold: true
          }
        }
      };

      this.utilsSvc.pdfMake();
      pdfMake.createPdf(docDefinition).open();

    } catch (error) {
      console.error('Error generando PDF:', error);
      this.utilsSvc.presentToast({
        message: 'Error al generar el PDF',
        color: 'danger',
        duration: 2500,
        position: 'middle'
      });
    } finally {
      loading.dismiss();
    }
  }

  clearFilters() {
    this.searchControl.setValue('');
    this.tipoControl.setValue('todos');
    this.estadoControl.setValue('todos');
  }
}