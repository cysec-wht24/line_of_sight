import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() selectedPoint: { lat: number; lon: number; elevation: number } | null = null;
  @Input() definePathMode: boolean = false;
  @Input() confirmedPoints: any[] = [];

  @Output() pointReset = new EventEmitter<void>();
  @Output() selectionModeChanged = new EventEmitter<boolean>();
  @Output() definePathModeChanged = new EventEmitter<boolean>();
  @Output() pathsChanged = new EventEmitter<any>();
  @Output() confirmDetailsFinalized = new EventEmitter<any>();
  @Output() confirmedPointsChange = new EventEmitter<any[]>();
  @Output() initialPointSelected = new EventEmitter<{ lat: number; lon: number; elevation: number }>();
  @Output() deletedPointIndexChange = new EventEmitter<number>();
  @Output() initialPointCleared = new EventEmitter<void>(); // ✅ added

  showCard = false;
  isOpen: boolean[] = [];
  message: string = '';

  paths: Array<{
    start: { lat: number; lon: number; elevation: number };
    path: { lat: number; lon: number; elevation: number }[];
  }> = [];

  terrainValue: number | null = null;
  terrainSegmentSize: number | null = null;

  selectionMode: boolean = false;
  addPointMode: boolean = false;
  currentPathIndex: number = -1;
  currentPath: { lat: number; lon: number; elevation: number }[] = [];

  selectedSpeed: number = 0;

  onTerrainChange() {
    this.terrainSegmentSize = this.getSegmentSize(this.terrainValue ?? 0);
  }

  getSegmentSize(num: number): number | null {
    if ([1, 6, 7, 9].includes(num)) return 500;
    if ([2, 3, 4].includes(num)) return 1000;
    if (num === 5) return 250;
    if (num === 8) return 100;
    if (num === 10) return 3000;
    return null;
  }

  startAddPoint() {
    this.addPointMode = true;
    this.selectionMode = true;
    this.selectedPoint = null;
    this.selectedSpeed = 0;
    this.showCard = true;
    this.message = '⚠️ Select an initial point from the map.';
    this.selectionModeChanged.emit(true);
  }

  onMapPointSelected(point: { lat: number; lon: number; elevation: number }) {
    if (!this.addPointMode) return;

    this.selectedPoint = point;
    this.message = '';

    // ✅ Emit point to draw on DEM
    this.initialPointSelected.emit(point);

    this.definePathMode = true;
    this.definePathModeChanged.emit(true);

    const pathEntry = { start: point, path: [] };
    this.paths.push(pathEntry);
    this.currentPathIndex = this.paths.length - 1;
    this.currentPath = [];
    this.selectedSpeed = 0;
  }

  addPathPoint(point: { lat: number; lon: number; elevation: number }) {
    if (!this.definePathMode || this.currentPathIndex < 0) return;

    this.currentPath.push(point);
    this.paths[this.currentPathIndex].path = [...this.currentPath];

    this.pathsChanged.emit({
      paths: [...this.paths],
      currentPath: [...this.currentPath],
      currentPathIndex: this.currentPathIndex
    });
  }

  finalizeCurrentPoint() {
    if (!this.selectedPoint || this.selectedSpeed <= 0 || this.currentPath.length === 0) return;

    const pointWithSpeed = { ...this.selectedPoint, speed: this.selectedSpeed };

    // Add to confirmed points
    this.confirmedPoints = [...this.confirmedPoints, pointWithSpeed];
    this.confirmedPointsChange.emit([...this.confirmedPoints]);
    this.initialPointCleared.emit();

    // Ensure UI state is synced
    this.isOpen = this.confirmedPoints.map(() => false);
    this.showCard = false;

    // Reset selection state for next point
    this.resetPathState();
  }

  redoCurrentPoint() {
    if (this.currentPath.length === 0) return;

    this.currentPath = [];
    if (this.currentPathIndex >= 0) {
      this.paths[this.currentPathIndex].path = [];
    }

    this.pathsChanged.emit({
      paths: [...this.paths],
      currentPath: [],
      currentPathIndex: this.currentPathIndex
    });
  }

  resetPathState() {
    this.selectedPoint = null;
    this.selectedSpeed = 0;
    this.currentPath = [];
    this.currentPathIndex = -1;
    this.addPointMode = false;
    this.selectionMode = false;
    this.definePathMode = false;
    this.message = '';

    this.selectionModeChanged.emit(false);
    this.definePathModeChanged.emit(false);
  }

  onDeleteClick(index: number, event: MouseEvent) {
    event.stopPropagation(); // Prevent toggleOpen from firing
    this.deletePoint(index);
  }

  deletePoint(index: number) {
    const isActiveInitial = this.selectedPoint &&
      this.paths[index] &&
      this.selectedPoint.lat === this.paths[index].start.lat &&
      this.selectedPoint.lon === this.paths[index].start.lon &&
      this.selectedPoint.elevation === this.paths[index].start.elevation;

    const isActivePath = this.currentPathIndex === index;

    if (isActiveInitial || isActivePath) {
      this.resetPathState();
      this.pathsChanged.emit({
        paths: [],
        currentPath: [],
        currentPathIndex: -1
      });
      this.pointReset.emit();
    }

    const updatedConfirmed = [...this.confirmedPoints];
    const updatedPaths = [...this.paths];
    const updatedIsOpen = [...this.isOpen];

    updatedConfirmed.splice(index, 1);
    updatedPaths.splice(index, 1);
    updatedIsOpen.splice(index, 1);

    this.confirmedPoints = updatedConfirmed;
    this.paths = updatedPaths;
    this.isOpen = updatedIsOpen;

    this.confirmedPointsChange.emit(updatedConfirmed);
    this.pathsChanged.emit({
      paths: [...updatedPaths],
      currentPath: [],
      currentPathIndex: -1
    });
  }

  toggleOpen(i: number) {
    this.isOpen = this.isOpen.map((_, index) => index === i ? !this.isOpen[i] : false);
  }

  handleDoneClick() {
    const hasTerrain = this.terrainValue !== null && this.terrainSegmentSize !== null;
    const hasPoints = this.confirmedPoints.length > 0;
    const allPathsSet =
      this.paths.length === this.confirmedPoints.length &&
      this.paths.every(p => p.path.length > 0);

    if (!hasTerrain || !hasPoints || !allPathsSet) {
      const reasons: string[] = [];
      if (!hasTerrain) reasons.push('terrain type');
      if (!hasPoints) reasons.push('at least one point');
      if (!allPathsSet) reasons.push('paths for all points');

      this.message = `❗ Please provide ${reasons.join(', ')} before proceeding.`;
      setTimeout(() => (this.message = ''), 3000);
      return;
    }

    this.onConfirmDetailsDone();
  }

  onConfirmDetailsDone() {
    console.log('📦 Preparing final simulation details...');

    const details = this.confirmedPoints.map((pt, i) => {
      // console.log(`🔹 Point ${i + 1}:`, pt);
      // console.log(`   ➤ Path:`, this.paths[i].path);
      return {
        start: {
          lat: pt.lat,
          lon: pt.lon,
          elevation: pt.elevation
        },
        path: this.paths[i].path,
        speed: pt.speed
      };
    });

    const payload = {
      segmentSize: this.terrainSegmentSize,
      details
    };

    console.log('✅ Emitting finalized data to parent component:', payload);

    this.confirmDetailsFinalized.emit(payload);

    this.message = '✅ Details submitted successfully.';
    setTimeout(() => (this.message = ''), 2000);
  }
}




