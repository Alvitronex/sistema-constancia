import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConstanciaReportePage } from './constancia-reporte.page';

describe('ConstanciaReportePage', () => {
  let component: ConstanciaReportePage;
  let fixture: ComponentFixture<ConstanciaReportePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ConstanciaReportePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
