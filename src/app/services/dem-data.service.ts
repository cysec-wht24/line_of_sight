import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DemDataService {
  rasterData: number[] = [];
  width: number = 0;
  height: number = 0;
  tiepointX: number = 0;
  tiepointY: number = 0;
  pixelSizeX: number = 1;
  pixelSizeY: number = 1;

  constructor() { }
}