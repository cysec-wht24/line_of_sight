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

  initialPoints: { lat: number; lon: number; elevation: number }[] = [];

  confirmedPoints: any[] = [];
  deletedPointIndex: number | null = null;

  movingPoints: { x: number, y: number, id: number }[] = [];

  paths: any[] = [];
  currentPath: any[] = [];
  currentPathIndex: number = 0;

  selectionMode = false;
  definePathMode = false;

  // ✅ Added: simulation result for slope-colored segments
  slopeColoredSimulation: any[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  onPositionsChanged(points: { lon: number, lat: number, id: number }[]) {
    this.movingPoints = points.map(p => ({
      x: p.lon,
      y: p.lat,
      id: p.id
    }));
  }

  onInitialPointSelected(point: { lat: number; lon: number; elevation: number }) {
    this.initialPoints = [...this.initialPoints, point];
  }

  // ✨ Called when sidebar tells us to clear the hollow red dot
  onInitialPointCleared() {
    this.initialPoints = [];
    this.cdr.detectChanges(); // optional: force rerender if needed
  }

  onConfirmDetailsFinalized(event: { segmentSize: number, details: any[] }) {
    console.log("✅ Finalized details received in main-view:", event);

    if (this.timeline) {
      this.timeline.startSimulation({
        segmentSize: event.segmentSize,
        details: event.details
      });
      // ✅ Store the simulation result to pass into <app-dem-display>
      this.slopeColoredSimulation = this.timeline.simulation;
    }
  }

  onPathsChanged(event: { paths?: any[], currentPath?: any[], currentPathIndex?: number }) {
    this.paths = Array.isArray(event.paths) ? [...event.paths] : [];
    this.currentPath = Array.isArray(event.currentPath) ? [...event.currentPath] : [];
    this.currentPathIndex = typeof event.currentPathIndex === 'number' ? event.currentPathIndex : 0;
    this.cdr.detectChanges();
  }

  onDefinePathModeChanged(enabled: boolean) {
    this.definePathMode = enabled;
  }

  onSelectionModeChanged(enabled: boolean) {
    this.selectionMode = enabled;
  }

  onPathPointSelected(point: { lat: number; lon: number; elevation: number }) {
    if (this.definePathMode) {
      this.sidebar.addPathPoint(point);
    }
  }

  onPointSelected(point: { lat: number; lon: number; elevation: number }) {
    if (this.selectionMode) {
      this.sidebar.onMapPointSelected(point);
    }
  }

  onDeletedPoint(index: number) {
    this.deletedPointIndex = index;

    // Optionally reset after short delay to avoid repeated triggering
    setTimeout(() => this.deletedPointIndex = null, 100);
  }
}



