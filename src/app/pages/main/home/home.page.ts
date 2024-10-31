import { Component, inject, OnInit } from '@angular/core';
import { Product } from 'src/app/models/product.model';
import { User } from 'src/app/models/user.models';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { AddUpdateProductComponent } from 'src/app/shared/components/add-update-product/add-update-product.component';
import { orderBy, where } from 'firebase/firestore';
import * as pdfMake from 'pdfmake/build/pdfmake';
// import * as pdfFonts from 'pdfmake/build/vfs_fonts';
// import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],

}) export class HomePage implements OnInit {
  
  firebaseSvc = inject(FirebaseService);
  utilsSvc = inject(UtilsService);
  pdfMake = inject(UtilsService).pdfMake();
  products: Product[] = [];
  displayedProducts: Product[] = [];
  loading: boolean = false;

  // Paginación
  pageSize: number = 10;
  currentPage: number = 1;
  totalPages: number = 1;
  pages: number[] = [];

  ngOnInit() {
    this.getProducts();
  }

  // === Obtener usuario ===
  user(): User {
    return this.utilsSvc.getFromLocalStorage('user');
  }

  // === Cargar vista ===
  ionViewWillEnter() {
    this.getProducts();
  }

  // === Refrescar ===
  doRefresh(event) {
    setTimeout(() => {
      this.getProducts();
      event.target.complete();
    }, 1000);
  }

  // === Obtener Ganancias Total ===
  getProfits() {
    return this.products.reduce((index, product) => index + product.price * product.soldUnits, 0)
  }

  // === Obtener Productos ===
  getProducts() {
    let path = `users/${this.user().uid}/product`;
    this.loading = true;

    let query = [orderBy('soldUnits', 'desc')];

    this.firebaseSvc.getCollectionData(path, query).subscribe({
      next: (res: any) => {
        this.products = res;
        this.totalPages = Math.ceil(this.products.length / this.pageSize);
        this.updateDisplayedProducts();
        this.updatePagination();
        this.loading = false;
      }
    });
  }
  // === Mostrar Productos por Pagina ===
  updateDisplayedProducts() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.displayedProducts = this.products.slice(start, end);
  }

  // === Paginación ===
  updatePagination() {
    const totalPages = Math.ceil(this.products.length / this.pageSize);
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    this.pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  }

  // === Ir a una pagina ===
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateDisplayedProducts();
      this.updatePagination();
    }
  }

  // === Pagina Siguiente ===
  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  // === Pagina Anterior ===
  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  // === Confirmar eliminación del producto ===
  async confirmDeleteProduct(product: Product) {
    this.utilsSvc.presentAlert({
      header: 'Eliminar Producto',
      message: 'Quieres eliminar este producto?',
      mode: 'ios',
      buttons: [
        {
          text: 'Cancelar',
        }, {
          text: 'Si, eliminar',
          handler: () => {
            this.deleteProduct(product);
          }
        }
      ]
    });

  }

  // ====== Agregar o actualizar producto =========
  async addUpdateProduct(product?: Product) {

    let success = await this.utilsSvc.presentModal({
      component: AddUpdateProductComponent,
      cssClass: 'add-update-modal',
      componentProps: { product }
    })

    if (success) this.getProducts();
  }
  // ======== Eliminar Producto ========
  async deleteProduct(product: Product) {

    let path = `users/${this.user().uid}/product/${product.id}`;

    const loading = await this.utilsSvc.loading();
    await loading.present();

    let imagePath = await this.firebaseSvc.getFilePath(product.image);
    await this.firebaseSvc.deleteFile(imagePath);


    this.firebaseSvc.deleteDocument(path).then(async res => {

      this.products = this.products.filter(p => p.id !== product.id);

      this.utilsSvc.presentToast({
        message: 'Producto eliminado exitosamente',
        duration: 1500,
        color: 'success',
        position: 'middle',
        icon: 'checkmark-circle-outline'
      })

    }).catch(error => {
      console.log(error);

      this.utilsSvc.presentToast({
        message: error.message,
        duration: 2500,
        color: 'primary',
        position: 'middle',
        icon: 'alert-circle-outline'
      })

    }).finally(() => {
      loading.dismiss();
    })
  }

  // === Generar PDF ===
  generatePDF(product?: Product) {
    let docDefinition: any;

    if (product) {
      // Generate PDF for a single product
      docDefinition = this.getSingleProductPdfDefinition(product);
    } else {
      // let uid = this.user().uid;
      // let path = `users/${uid}`;

      // Generate PDF for all products
      docDefinition = this.getAllProductsPdfDefinition();
    }

    pdfMake.createPdf(docDefinition).open();
  }

  // === Generar PDF por un solo producto ===
  private getSingleProductPdfDefinition(product: Product): any {
    return {
      content: [
        { text: 'Detalle Producto', style: 'header' },
        {
          table: {
            body: [
              ['Nombre', product.name],
              ['Precio', `$${product.price.toFixed(2)}`],
              ['Unidades Vendidas', product.soldUnits],
              ['Ganancia Vendidas', `$${(product.price * product.soldUnits).toFixed(2)}`]
            ]
          }
        }
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10],
        },
        totalProfit: {
          fontSize: 14,
          bold: true,
          margin: [0, 0, 0, 10],
        }
      }
    };
  }

 // === Generar PDF de todos los Productos ===
  private getAllProductsPdfDefinition(): any {
    const tableBody = [
      ['N*', 'Nombre', 'Precio', 'Unidades Vendidas', 'Ganancias Vendidas']
    ];

    let counter = 1;
    this.products.forEach(product => {
      tableBody.push([
        counter.toString(),

        product.name,
        `$${product.price.toFixed(2)}`,
        product.soldUnits.toString(),
        `$${(product.price * product.soldUnits).toFixed(2)}`

      ]);

      counter++;
    });

    const user = this.user();
    return {
      content: [
        { text: 'Resumen de Productos', style: 'header' },
        { text: `Generado por: ${user.name}`, style: 'subheader' },
        { text: `Fecha: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`, style: 'subheader' },
        {
          table: {
            headerRows: 1,
            body: tableBody
          }
        },
        { text: `Ganancias Vendidas en total: $${this.getProfits().toFixed(2)}`, style: 'totalProfit' }
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 14,
          margin: [0, 0, 0, 5],
        },
        totalProfit: {
          fontSize: 14,
          bold: true,
          margin: [0, 10, 0, 0]
        }
      }
    };
  }
}