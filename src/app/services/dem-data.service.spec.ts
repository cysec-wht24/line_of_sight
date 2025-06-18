import { TestBed } from '@angular/core/testing';

import { DemDataService } from './dem-data.service';

describe('DemDataService', () => {
  let service: DemDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DemDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
