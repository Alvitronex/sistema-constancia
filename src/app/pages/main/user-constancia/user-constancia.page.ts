import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { takeUntil, debounceTime, map, startWith, take } from 'rxjs/operators';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { Constancia } from 'src/app/models/constancia.model';
import { orderBy } from '@angular/fire/firestore';
import { ModalController } from '@ionic/angular';
import { ConstanciaDetailComponent } from 'src/app/shared/components/constancia-detail/constancia-detail.component';
import { CreateConstanciaComponent } from 'src/app/shared/components/create-constancia/create-constancia.component';
import * as pdfMake from 'pdfmake/build/pdfmake';
import { User } from 'src/app/models/user.models';

@Component({
  selector: 'app-user-constancia',
  templateUrl: './user-constancia.page.html',
  styleUrls: ['./user-constancia.page.scss'],
})
export class UserConstanciaPage implements OnInit, OnDestroy, AfterViewInit {
  constancias$: Observable<Constancia[]>;
  filteredConstancias$: Observable<Constancia[]>;
  loading = true;
  error = false;
  searchControl = new FormControl('');
  tipoControl = new FormControl('todos');
  estadoControl = new FormControl('todos');
  private destroy$ = new Subject<void>();
  paginatedConstancias: Constancia[] = [];
  pageSize: number = 5;
  currentPage: number = 1;
  totalPages: number = 1;
  pages: number[] = [];
  Math = Math;
  private allConstancias: Constancia[] = [];
  constancias: Constancia[] = [];

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
    this.getConstancias();
  }



  private filterConstancias(
    constancias: Constancia[],
    searchTerm: string,
    tipo: string,
    estado: string
  ): Constancia[] {
    searchTerm = searchTerm || '';

    return constancias.filter(constancia => {
      const searchString = [
        constancia.nombre,
        constancia.apellidos,
        constancia.documento
      ].join(' ').toLowerCase();

      const termToSearch = searchTerm.toLowerCase().trim();

      const matchesSearch = searchString.includes(termToSearch);
      const matchesTipo = tipo === 'todos' || constancia.tipo === tipo;
      const matchesEstado = estado === 'todos' || constancia.estado === estado;

      return matchesSearch && matchesTipo && matchesEstado;
    });
  }


  async openConstanciaDetail(constancia: Constancia) {
    const modal = await this.modalController.create({
      component: ConstanciaDetailComponent,
      componentProps: { constancia }
    });
    return await modal.present();
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

  // Agregar métodos de paginación
  updatePaginatedConstancias(constancias: Constancia[]) {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedConstancias = constancias.slice(start, end);
  }

  updatePagination() {
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(this.totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    this.pages = Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i
    );
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      combineLatest([
        of(this.allConstancias),
        of(this.searchControl.value || ''),
        of(this.tipoControl.value || 'todos'),
        of(this.estadoControl.value || 'todos')
      ]).pipe(
        take(1),
        map(([constancias, searchTerm, tipo, estado]) => {
          const filtered = this.filterConstancias(constancias, searchTerm, tipo, estado);
          this.updatePaginatedConstancias(filtered);
          this.updatePagination();
        })
      ).subscribe();
    }
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }
  get hasConstancias(): boolean {
    return this.allConstancias.length > 0;
  }
  private getCurrentUser(): User {
    return this.utilsSvc.getFromLocalStorage('user');
  }





  /* nuevo codigo */
  // === Obtener usuario ===
  user(): User {
    return this.utilsSvc.getFromLocalStorage('user');
  }


  // === Cargar vista ===
  ionViewWillEnter() {
    this.getConstancias();
  }

  // === Refrescar ===
  doRefresh(event) {
    setTimeout(() => {
      this.getConstancias();
      event.target.complete();
    }, 1000);
  }

  // === Obtener Constancias ===
  getConstancias() {
    this.loading = true;
    let path = `users/${this.user().uid}/constancia`;

    let query = [orderBy('createdAt', 'desc')];

    this.firebaseSvc.getCollectionData(path, query).subscribe({
      next: (res: any) => {
        this.constancias = res;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error in getConstancias:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  // === Aplicar Filtros ===
  private applyFilters() {
    const searchTerm = this.searchControl.value || '';
    const tipo = this.tipoControl.value || 'todos';
    const estado = this.estadoControl.value || 'todos';

    const filtered = this.filterConstancias(
      this.constancias,
      searchTerm,
      tipo,
      estado
    );

    this.totalPages = Math.ceil(filtered.length / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }

    this.updatePaginatedConstancias(filtered);
    this.updatePagination();
  }

  // ====== Crear constancia =========
  async addConstancia() {
    let success = await this.utilsSvc.presentModal({
      component: CreateConstanciaComponent,
      cssClass: 'modal-full-right-side'
    });

    if (success) this.getConstancias();
  }

  // ... resto de los métodos de paginación y filtrado ...
  // === Crear constancia ===
  async createConstancia() {
    const path = `users/${this.user().uid}/constancia`;

    const modal = await this.modalController.create({
      component: CreateConstanciaComponent,
      componentProps: { path }, // Pasamos el path al componente
      cssClass: 'modal-full-right-side'
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.created) {
      this.getConstancias();
    }
  }
  // === Rastrear cambios en los filtros ===
  ngAfterViewInit() {
    combineLatest([
      this.searchControl.valueChanges.pipe(startWith('')),
      this.tipoControl.valueChanges.pipe(startWith('todos')),
      this.estadoControl.valueChanges.pipe(startWith('todos'))
    ]).pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
