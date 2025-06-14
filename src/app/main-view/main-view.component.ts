import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TimelineComponent } from './timeline/timeline.component';

@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent {
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;
  @ViewChild(TimelineComponent) timeline!: TimelineComponent;

  selectedPoint: { lat: number; lon: number; elevation: number } | null = null;
  confirmedPoints: { lat: number; lon: number; elevation: number }[] = [];
  movingPoints: { x: number, y: number, id: number }[] = [];

  paths: any[] = [];
  currentPath: any[] = [];
  currentPathIndex: number = 0;
  rasterData: number[] = [];
  width: number = 0;
  height: number = 0;
  tiepointX: number = 0;
  tiepointY: number = 0;
  pixelSizeX: number = 1;
  pixelSizeY: number = 1;

  constructor(private cdr: ChangeDetectorRef) {}

  onPositionsChanged(points: { lon: number, lat: number, id: number }[]) {
    this.movingPoints = points.map(p => ({
      x: p.lon,
      y: p.lat,
      id: p.id
    }));
  }

  onConfirmDetailsFinalized(details: any) {
    if (this.timeline) {
      this.timeline.startSimulation(details);
    }
  }

  onPathsChanged(event: { paths?: any[], currentPath?: any[], currentPathIndex?: number }) {
    this.paths = Array.isArray(event.paths) ? [...event.paths] : [];
    this.currentPath = Array.isArray(event.currentPath) ? [...event.currentPath] : [];
    this.currentPathIndex = typeof event.currentPathIndex === 'number' ? event.currentPathIndex : 0;
    this.cdr.detectChanges();
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
    this.confirmedPoints = []; // Clears all previously confirmed points
  }
}

