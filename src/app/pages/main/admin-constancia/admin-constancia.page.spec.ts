import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminConstanciaPage } from './admin-constancia.page';

describe('AdminConstanciaPage', () => {
  let component: AdminConstanciaPage;
  let fixture: ComponentFixture<AdminConstanciaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminConstanciaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
