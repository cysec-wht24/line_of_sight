import { Component, ViewChild } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent {
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;

  selectedPoint: { lat: number; lon: number; elevation: number } | null = null;
  confirmedPoints: { lat: number; lon: number; elevation: number }[] = [];
  paths: Array<{ start: { lat: number; lon: number; elevation: number }, path: { lat: number; lon: number; elevation: number }[] }> = [];

  onPathsChanged(paths: any) {
    this.paths = [...paths]; // assign a new array reference
  }

  selectionMode = false;
  definePathMode = false;

  onDefinePathModeChanged(enabled: boolean) {
    this.definePathMode = enabled;
  }

  onPathPointSelected(point: { lat: number; lon: number; elevation: number }) {
    if (this.definePathMode) {
      this.sidebar.addPathPoint(point);
    }
  }

  onSelectionModeChanged(enabled: boolean) {
    this.selectionMode = enabled;
  }
  
  onPointSelected(point: { lat: number; lon: number; elevation: number }) {
      this.selectedPoint = point;
      
  }

  onPointConfirmed(point: { lat: number; lon: number; elevation: number }) {
  this.confirmedPoints = [...this.confirmedPoints, point];
  console.log('✅ Confirmed Points:', this.confirmedPoints);
  this.selectedPoint = null; // Clear current so user can click next
}

  onPointReset() {
    this.selectedPoint = null; // Clear current selection
    this.confirmedPoints = []; // 👈 Clears all previously confirmed points
  }
}

