import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, map, startWith, take } from 'rxjs/operators';
import { User } from 'src/app/models/user.models';
import { FirebaseService } from 'src/app/services/firebase.service';
import { UtilsService } from 'src/app/services/utils.service';
import { orderBy } from '@angular/fire/firestore';
import { AddUpdateUserComponent } from 'src/app/shared/components/add-update-user/add-update-user.component';

@Component({
  selector: 'app-panel',
  templateUrl: './panel.page.html',
  styleUrls: ['./panel.page.scss'],
})
export class PanelPage implements OnInit, OnDestroy {
  users$: Observable<User[]>;
  filteredUsers$: Observable<User[]>;
  loading = true;
  error = false;

  searchControl = new FormControl('');
  roleControl = new FormControl('todos');
  private destroy$ = new Subject<void>();

  // Paginación
  paginatedUsers: User[] = [];
  pageSize: number = 8;
  currentPage: number = 1;
  totalPages: number = 1;
  pages: number[] = [];

  constructor(
    private firebaseSvc: FirebaseService,
    private utilsSvc: UtilsService
  ) { }

  ngOnInit() {
    this.loadUsers();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private filterUsers(users: User[], searchTerm: string, role: string): User[] {
    return users.filter(user => {
      const searchString = [user.name, user.email].join(' ').toLowerCase();
      const matchesSearch = searchString.includes(searchTerm.toLowerCase().trim());
      const matchesRole = role === 'todos' || user.role === role;
      return matchesSearch && matchesRole;
    });
  }

  loadUsers() {
    try {
      const usersRef = this.firebaseSvc.getCollectionData(
        'users',
        [orderBy('name', 'asc')]
      ) as Observable<User[]>;

      this.filteredUsers$ = combineLatest([
        usersRef,
        this.searchControl.valueChanges.pipe(startWith('')),
        this.roleControl.valueChanges.pipe(startWith('todos'))
      ]).pipe(
        debounceTime(300),
        map(([users, searchTerm, role]) => {
          const filtered = this.filterUsers(users, searchTerm || '', role);
          this.totalPages = Math.ceil(filtered.length / this.pageSize);

          if (this.currentPage > this.totalPages) {
            this.currentPage = 1;
          }

          this.updatePaginatedUsers(filtered);
          this.updatePagination();
          this.loading = false;
          return filtered;
        }),
        takeUntil(this.destroy$)
      );

      this.filteredUsers$.subscribe();
    } catch (error) {
      console.error('Error in loadUsers:', error);
      this.error = true;
      this.loading = false;
    }
  }

  updatePaginatedUsers(users: User[]) {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedUsers = users.slice(start, end);
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

  clearFilters() {
    this.searchControl.setValue('');
    this.roleControl.setValue('todos');
    this.currentPage = 1;
  }

  getRoleDisplay(role: string): string {
    const roles = {
      admin: 'Administrador',
      planillero: 'Planillero',
      usuario: 'Usuario'
    };
    return roles[role] || role;
  }

  getRoleColor(role: string): string {
    const colors = {
      admin: 'primary',
      planillero: 'tertiary',
      usuario: 'success'
    };
    return colors[role] || 'medium';
  }

  async addUpdateUser(user?: User) {
    const modal = await this.utilsSvc.presentModal({
      component: AddUpdateUserComponent,
      cssClass: 'add-update-modal',
      componentProps: { user }
    });

    const { data } = await modal.onWillDismiss();
    if (data?.updated) {
      this.loadUsers();
    }
  }

  async onDeleteUser(user: User) {
    const alert = await this.utilsSvc.presentAlert({
      header: 'Confirmar eliminación',
      message: `¿Está seguro de eliminar al usuario ${user.name}?`,
      mode: 'ios',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            const loading = await this.utilsSvc.loading();
            try {
              await loading.present();
              await this.firebaseSvc.deleteDocument(`users/${user.uid}`);

              this.utilsSvc.presentToast({
                message: 'Usuario eliminado correctamente',
                color: 'success',
                duration: 2500,
                position: 'middle'
              });

              this.loadUsers();
            } catch (error) {
              console.error('Error al eliminar usuario:', error);
              this.utilsSvc.presentToast({
                message: 'Error al eliminar el usuario',
                color: 'danger',
                duration: 2500,
                position: 'middle'
              });
            } finally {
              loading.dismiss();
            }
          }
        }
      ]
    });
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.filteredUsers$.pipe(take(1)).subscribe(users => {
        this.updatePaginatedUsers(users);
        this.updatePagination();
      });
    }
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }
}