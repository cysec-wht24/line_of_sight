import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TimelineComponent } from './timeline/timeline.component';
import { DemDisplayComponent } from './dem-display/dem-display.component';

@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent {
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;
  @ViewChild(TimelineComponent) timeline!: TimelineComponent;
  @ViewChild(DemDisplayComponent) demDisplay!: DemDisplayComponent;

  initialPoints: { lat: number; lon: number; elevation: number }[] = [];

  confirmedPoints: any[] = [];
  timelineVisible: boolean = false;
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

    // Show timeline first
    this.timelineVisible = true;

    // Wait for Angular to render <app-timeline> before calling its method
    setTimeout(() => {
      this.cdr.detectChanges(); // ensure timeline is available now

      if (this.timeline) {
        this.timeline.startSimulation({
          segmentSize: event.segmentSize,
          details: event.details
        });
        this.slopeColoredSimulation = this.timeline.simulation;
      } else {
        console.warn("⚠️ Timeline not ready even after view init");
      }
    }, 0);
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

  onSidebarReset() {
    console.log('🔁 Reset triggered by sidebar Redo button');

    // Hide the timeline
    this.timelineVisible = false;

    // Reset slope-colored animation data
    this.slopeColoredSimulation = [];

    // Reset DEM animation / drawing if needed
    this.movingPoints = [];

    // Reset timeline component state (optional)
    if (this.timeline && typeof this.timeline.clearSimulation === 'function') {
      this.timeline.clearSimulation(); // Create this method in <app-timeline> if not already present
    }

    if (this.demDisplay && typeof this.demDisplay.clearDisplay === 'function') {
      this.demDisplay.clearDisplay();
    }

    // Reset other internal flags
    this.paths = [];
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.initialPoints = [];
    this.deletedPointIndex = null;

    this.selectionMode = false;
    this.definePathMode = false;

    // Trigger change detection
    this.cdr.detectChanges();
  }
}



