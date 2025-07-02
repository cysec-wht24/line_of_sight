import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';

// Importing child components for direct interaction via @ViewChild
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TimelineComponent } from './timeline/timeline.component';
import { DemDisplayComponent } from './dem-display/dem-display.component';

@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent {
  // References to child components
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;
  @ViewChild(TimelineComponent) timeline!: TimelineComponent;
  @ViewChild(DemDisplayComponent) demDisplay!: DemDisplayComponent;

  // Stores the red-hollow marker coordinates for initial point selection
  initialPoints: { lat: number; lon: number; elevation: number }[] = [];

  // List of all finalized points with speed (confirmed from sidebar)
  confirmedPoints: any[] = [];

  // Controls whether timeline panel is shown after "Done"
  timelineVisible: boolean = false;

  // Index of recently deleted point, used for UI coordination
  deletedPointIndex: number | null = null;

  // Points currently being animated/moved on the DEM map
  movingPoints: { x: number, y: number, id: number }[] = [];

  // Stores all user-defined paths
  paths: any[] = [];

  // Currently active path that’s being defined
  currentPath: any[] = [];

  // Index of the current path (for tracking active editing)
  currentPathIndex: number = 0;

  // Flags to indicate if app is in selection or path-definition mode
  selectionMode = false;
  definePathMode = false;

  // Stores full simulation results including slope color for each segment
  slopeColoredSimulation: any[] = [];

  // Injects Angular change detection to force updates when needed
  constructor(private cdr: ChangeDetectorRef) {}

  /**
   * 🔄 Receives updated positions from timeline (on slider change)
   * Converts them into display format for animation (lon/lat → x/y)
   */
  onPositionsChanged(points: { lon: number, lat: number, id: number }[]) {
    this.movingPoints = points.map(p => ({
      x: p.lon,
      y: p.lat,
      id: p.id
    }));
  }

  /**
   * 📍 Triggered when sidebar emits a newly selected initial point
   * Adds that point to the initialPoints list to draw red-hollow marker
   */
  onInitialPointSelected(point: { lat: number; lon: number; elevation: number }) {
    this.initialPoints = [...this.initialPoints, point];
  }

  /**
   * 🚫 Called when sidebar finalizes the current point
   * Clears the red-hollow initial marker and optionally re-renders
   */
  onInitialPointCleared() {
    this.initialPoints = [];
    this.cdr.detectChanges(); // Optional: ensure marker is removed visually
  }

  /**
   * ✅ Triggered when user clicks "Done" on sidebar
   * Shows timeline, passes simulation config to timeline component,
   * and stores the result to enable slope color rendering on DEM
   */
  onConfirmDetailsFinalized(event: { segmentSize: number, details: any[] }) {
    console.log("✅ Finalized details received in main-view:", event);

    this.timelineVisible = true;

    // Delay to ensure <app-timeline> is rendered before using it
    setTimeout(() => {
      this.cdr.detectChanges();

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

  /**
   * ↩️ Called when sidebar updates any path information
   * Synchronizes the paths and current editing path with main view
   */
  onPathsChanged(event: { paths?: any[], currentPath?: any[], currentPathIndex?: number }) {
    this.paths = Array.isArray(event.paths) ? [...event.paths] : [];
    this.currentPath = Array.isArray(event.currentPath) ? [...event.currentPath] : [];
    this.currentPathIndex = typeof event.currentPathIndex === 'number' ? event.currentPathIndex : 0;
    this.cdr.detectChanges();
  }

  /**
   * 🔀 Enables or disables path definition mode
   * Called by sidebar when user starts/stops drawing a path
   */
  onDefinePathModeChanged(enabled: boolean) {
    this.definePathMode = enabled;
  }

  /**
   * 🔘 Enables or disables selection mode
   * Called by sidebar when user begins or ends initial point selection
   */
  onSelectionModeChanged(enabled: boolean) {
    this.selectionMode = enabled;
  }

  /**
   * ➕ Called when a map click occurs in definePath mode
   * Adds a point to the currently active path via sidebar
   */
  onPathPointSelected(point: { lat: number; lon: number; elevation: number }) {
    if (this.definePathMode) {
      this.sidebar.addPathPoint(point);
    }
  }

  /**
   * 🟥 Called when a map click occurs in selection mode
   * Sends selected point to sidebar as an initial start point
   */
  onPointSelected(point: { lat: number; lon: number; elevation: number }) {
    if (this.selectionMode) {
      this.sidebar.onMapPointSelected(point);
    }
  }

  /**
   * 🗑️ Receives notification that a point was deleted
   * Temporarily sets the deleted index to trigger any visual reset
   */
  onDeletedPoint(index: number) {
    this.deletedPointIndex = index;

    setTimeout(() => this.deletedPointIndex = null, 100); // Prevents repeated triggering
  }

  /**
   * 🔁 Triggered when user clicks the Redo button on the sidebar
   * Resets everything: UI, DEM markers, timeline, and animation data
   */
  onSidebarReset() {
    console.log('🔁 Reset triggered by sidebar Redo button');

    this.timelineVisible = false;
    this.slopeColoredSimulation = [];
    this.movingPoints = [];

    if (this.timeline && typeof this.timeline.clearSimulation === 'function') {
      this.timeline.clearSimulation();
    }

    if (this.demDisplay && typeof this.demDisplay.clearDisplay === 'function') {
      this.demDisplay.clearDisplay();
    }

    this.paths = [];
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.initialPoints = [];
    this.deletedPointIndex = null;

    this.selectionMode = false;
    this.definePathMode = false;

    this.cdr.detectChanges(); // Final forced refresh
  }
}



