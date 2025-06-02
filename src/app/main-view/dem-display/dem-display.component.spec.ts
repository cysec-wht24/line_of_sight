import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DemDisplayComponent } from './dem-display.component';

describe('DemDisplayComponent', () => {
  let component: DemDisplayComponent;
  let fixture: ComponentFixture<DemDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DemDisplayComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DemDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
