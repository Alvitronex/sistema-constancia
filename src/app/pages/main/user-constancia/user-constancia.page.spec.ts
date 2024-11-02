import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserConstanciaPage } from './user-constancia.page';

describe('UserConstanciaPage', () => {
  let component: UserConstanciaPage;
  let fixture: ComponentFixture<UserConstanciaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UserConstanciaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
