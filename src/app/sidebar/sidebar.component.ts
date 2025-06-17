import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() selectedPoint: { lat: number; lon: number; elevation: number } | null = null;
  @Input() confirmedPoints: { lat: number; lon: number; elevation: number }[] = [];
  @Input() definePathMode: boolean = false;

  @Output() pointConfirmed = new EventEmitter<{ lat: number; lon: number; elevation: number }>();
  @Output() pointReset = new EventEmitter<void>();
  @Output() selectionModeChanged = new EventEmitter<boolean>();
  @Output() definePathModeChanged = new EventEmitter<boolean>();
  @Output() pathsChanged = new EventEmitter<any>();
  @Output() confirmDetailsFinalized = new EventEmitter<any>();

  message: string = '';
  commandInput: string = '';
  selectionMode: boolean = false;
  defineSpecMode: boolean = false;
  currentSpecIndex: number = 0;
  specInputs: { speed: number }[] = [];
  specSpeed: string = '';

  currentPathIndex: number = 0;
  paths: Array<{
    start: { lat: number; lon: number; elevation: number };
    path: { lat: number; lon: number; elevation: number }[];
  }> = [];
  currentPath: { lat: number; lon: number; elevation: number }[] = [];

    // New: Terrain data
  terrainValue: number | null = null;
  terrainSegmentSize: number | null = null;

  processCommand() {
    const cmd = this.commandInput.trim();
    this.message = '';

    // Match terrain command
    const terrainMatch = cmd.match(/^terrain\s*(\d+)$/);
    if (terrainMatch) {
      const value = parseInt(terrainMatch[1], 10);
      this.terrainValue = value;
      this.terrainSegmentSize = this.getSegmentSize(value);
      if (this.terrainSegmentSize) {
        this.message = `Terrain type ${value} set with segment size ${this.terrainSegmentSize} m`;
      } else {
        this.message = `Invalid terrain number: ${value}`;
        this.terrainValue = null;
      }
      this.commandInput = '';
      return;
    }

    // Existing commands
    if (cmd === 'select') {
      this.selectionMode = true;
      this.selectionModeChanged.emit(true);
      this.defineSpecMode = false;
      if (this.definePathMode) {
        this.definePathMode = false;
        this.definePathModeChanged.emit(false);
      }
    } else if (cmd === 'def-spec') {
      this.selectionMode = false;
      this.selectionModeChanged.emit(false);
      this.defineSpecMode = true;
      if (this.definePathMode) {
        this.definePathMode = false;
        this.definePathModeChanged.emit(false);
      }
      this.currentSpecIndex = 0;
      this.specInputs = this.confirmedPoints.map(() => ({ speed: 0 }));
      this.specSpeed = '';
    } else if (cmd === 'def-path') {
      this.selectionMode = false;
      this.selectionModeChanged.emit(false);
      this.defineSpecMode = false;
      this.definePathMode = true;
      this.definePathModeChanged.emit(true);
      this.currentPathIndex = 0;
      this.paths = this.confirmedPoints.map(pt => ({
        start: pt,
        path: []
      }));
      this.currentPath = [];
    } else if (cmd === 'confirm') {
      this.selectionMode = false;
      this.selectionModeChanged.emit(false);
      this.defineSpecMode = false;
      if (this.definePathMode) {
        this.definePathMode = false;
        this.definePathModeChanged.emit(false);
      }
      this.message = this.getAllDetails();
    } else {
      this.selectionMode = false;
      this.selectionModeChanged.emit(false);
      this.defineSpecMode = false;
      if (this.definePathMode) {
        this.definePathMode = false;
        this.definePathModeChanged.emit(false);
      }
    }

    this.commandInput = '';
  }

  // Mapping terrain input to segment size
  getSegmentSize(num: number): number | null {
    if (num === 1 || num === 6 || num === 7 || num === 9) return 500;
    if ([2, 3, 4].includes(num)) return 1000;
    if (num === 5) return 250;
    if (num === 8) return 100;
    if (num === 10) return 3000;
    return null;
  }

  getAllDetails(): string {
    let msg = '';
    msg += `Confirmed Points:\n`;

    if (this.terrainSegmentSize && this.terrainValue !== null) {
      msg += `\nTerrain:\n  Terrain Type: ${this.terrainValue}, Segment Size: ${this.terrainSegmentSize}m\n`;
    }

    this.confirmedPoints.forEach((pt, i) => {
      msg += `  ${i + 1}: lat=${pt.lat}, lon=${pt.lon}, elev=${pt.elevation}\n`;
    });

    if (this.specInputs.length) {
      msg += `\nSpecs:\n`;
      this.specInputs.forEach((spec, i) => {
        msg += `  Point ${i + 1}: speed=${spec.speed}\n`;
      });
    }

    if (this.paths.length) {
      msg += `\nPaths:\n`;
      this.paths.forEach((p, i) => {
        msg += `  Path ${i + 1} (from lat=${p.start.lat}, lon=${p.start.lon}):\n`;
        p.path.forEach((pt, j) => {
          msg += `    ${j + 1}: lat=${pt.lat}, lon=${pt.lon}, elev=${pt.elevation}\n`;
        });
      });
    }

    return msg || 'No details available.';
  }

  addPathPoint(point: { lat: number; lon: number; elevation: number }) {
    if (this.definePathMode) {
      this.currentPath.push(point);
      this.pathsChanged.emit({
        paths: [...this.paths],
        currentPath: [...this.currentPath],
        currentPathIndex: this.currentPathIndex
      });
    }
  }

  onPathDone() {
    this.paths[this.currentPathIndex].path = [...this.currentPath];
    if (this.currentPathIndex < this.confirmedPoints.length - 1) {
      this.currentPathIndex++;
      this.currentPath = [];
    } else {
      this.definePathMode = false;
      this.definePathModeChanged.emit(false);
    }
    this.pathsChanged.emit({
      paths: [...this.paths],
      currentPath: [],
      currentPathIndex: this.currentPathIndex
    });
  }

  onPathRedo() {
    this.currentPath = [];
  }

  onSpecDone() {
    if (!this.specSpeed) return;
    this.specInputs[this.currentSpecIndex] = {
      speed: Number(this.specSpeed)
    };
    if (this.currentSpecIndex < this.confirmedPoints.length - 1) {
      this.currentSpecIndex++;
      this.specSpeed = '';
    } else {
      const result = this.confirmedPoints.map((pt, i) => ({
        ...pt,
        speed: this.specInputs[i].speed
      }));
      this.defineSpecMode = false;
      console.log('All specs:', result);
    }
  }

  onSpecRedo() {
    if (this.currentSpecIndex > 0) {
      this.currentSpecIndex--;
      const prev = this.specInputs[this.currentSpecIndex];
      this.specSpeed = prev.speed ? String(prev.speed) : '';
    }
  }

  hardReset() {
    this.confirmedPoints = [];
    this.specInputs = [];
    this.specSpeed = '';
    this.currentSpecIndex = 0;
    this.paths = [];
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.message = '';
    this.selectionMode = false;
    this.defineSpecMode = false;
    this.definePathMode = false;
    this.selectionModeChanged.emit(false);
    this.definePathModeChanged.emit(false);
    this.pathsChanged.emit({
      paths: [],
      currentPath: [],
      currentPathIndex: 0
    });
    this.pointReset.emit();
  }

  onConfirmDetailsDone() {
    const allHaveSpecs = this.specInputs.length === this.confirmedPoints.length &&
      this.specInputs.every(spec => spec.speed > 0);
    const allHavePaths = this.paths.length === this.confirmedPoints.length &&
      this.paths.every(p => Array.isArray(p.path) && p.path.length > 0);

    if (!allHaveSpecs || !allHavePaths) {
      this.message = "Fill all details for all points";
      return;
    }

    const details = this.confirmedPoints.map((pt, i) => ({
      start: pt,
      path: this.paths[i].path,
      speed: this.specInputs[i].speed
    }));

    this.confirmDetailsFinalized.emit(details);
    this.message = '';
  }

  confirmPoint() {
    if (this.selectedPoint) {
      console.log("console log of sidebar.component.ts has been run for confirmPoint");
      this.pointConfirmed.emit(this.selectedPoint);
    }
  }

  resetPoint() {
    console.log("console log of sidebar.component.ts has been run for resetPoint");
    this.pointReset.emit();
  }
}



