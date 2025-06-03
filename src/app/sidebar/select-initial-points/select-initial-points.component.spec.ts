import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectInitialPointsComponent } from './select-initial-points.component';

describe('SelectInitialPointsComponent', () => {
  let component: SelectInitialPointsComponent;
  let fixture: ComponentFixture<SelectInitialPointsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SelectInitialPointsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectInitialPointsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
