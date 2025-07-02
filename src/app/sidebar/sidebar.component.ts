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
  @Output() initialPointCleared = new EventEmitter<void>();

  showCard = false;
  isOpen: boolean[] = [];
  message: string = '';

  paths: Array<{
    start: { lat: number; lon: number; elevation: number };
    path: { lat: number; lon: number; elevation: number }[];
  }> = [];

  segmentCount: number = 0;

  selectionMode: boolean = false;
  addPointMode: boolean = false;
  currentPathIndex: number = -1;
  currentPath: { lat: number; lon: number; elevation: number }[] = [];

  selectedSpeed: number = 0;

  onSegmentCountChange() {}

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
    this.confirmedPoints = [...this.confirmedPoints, pointWithSpeed];
    this.confirmedPointsChange.emit([...this.confirmedPoints]);
    this.initialPointCleared.emit();

    this.isOpen = this.confirmedPoints.map(() => false);
    this.showCard = false;
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
    event.stopPropagation();
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
    const hasSegmentCount = this.segmentCount !== null && this.segmentCount > 0;
    const hasPoints = this.confirmedPoints.length > 0;
    const allPathsSet =
      this.paths.length === this.confirmedPoints.length &&
      this.paths.every(p => p.path.length > 0);

    if (!hasSegmentCount || !hasPoints || !allPathsSet) {
      const reasons: string[] = [];
      if (!hasSegmentCount) reasons.push('segment count');
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

    const details = this.confirmedPoints.map((pt, i) => ({
      start: {
        lat: pt.lat,
        lon: pt.lon,
        elevation: pt.elevation
      },
      path: this.paths[i].path,
      speed: pt.speed
    }));

    const payload = {
      segmentSize: this.segmentCount,
      details
    };

    console.log('✅ Emitting finalized data to parent component:', payload);
    this.confirmDetailsFinalized.emit(payload);

    this.message = '✅ Details submitted successfully.';
    setTimeout(() => (this.message = ''), 2000);
  }

  handleRedoClick() {
    this.segmentCount = 0;
    this.selectionMode = false;
    this.addPointMode = false;
    this.definePathMode = false;
    this.currentPathIndex = -1;
    this.currentPath = [];
    this.selectedPoint = null;
    this.selectedSpeed = 0;
    this.message = '';
    this.showCard = false;
    this.confirmedPoints = [];
    this.paths = [];
    this.isOpen = [];

    this.selectionModeChanged.emit(false);
    this.definePathModeChanged.emit(false);
    this.pathsChanged.emit({ paths: [], currentPath: [], currentPathIndex: -1 });
    this.confirmedPointsChange.emit([]);
    this.initialPointCleared.emit();
    this.pointReset.emit();

    console.log("🔁 Redo clicked: All state reset");
  }
}




