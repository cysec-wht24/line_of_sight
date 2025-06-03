import { Component } from '@angular/core';

@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent {
  selectedPoint: { lat: number; lon: number; elevation: number } | null = null;
  confirmedPoints: { lat: number; lon: number; elevation: number }[] = [];

  onPointSelected(point: { lat: number; lon: number; elevation: number }) {
    this.selectedPoint = point;
  }

  onPointConfirmed(point: { lat: number; lon: number; elevation: number }) {
  this.confirmedPoints.push(point);
  console.log('✅ Confirmed Points:', this.confirmedPoints);
  this.selectedPoint = null; // Clear current so user can click next
}

  onPointReset() {
    this.selectedPoint = null; // Clear current selection
    this.confirmedPoints = []; // 👈 Clears all previously confirmed points
  }
}

