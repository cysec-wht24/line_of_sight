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
 
  message: string = '';
  commandInput: string = '';
  selectionMode: boolean = false;
  defineSpecMode: boolean = false;
  currentSpecIndex: number = 0;
  specInputs: { speed: number; height: number }[] = [];
  specSpeed: string = '';
  specHeight: string = '';
   // Path state
  currentPathIndex: number = 0;
  paths: Array<{
    start: { lat: number; lon: number; elevation: number };
    path: { lat: number; lon: number; elevation: number }[];
  }> = [];
  currentPath: { lat: number; lon: number; elevation: number }[] = [];

  processCommand() {
    const cmd = this.commandInput.trim();
    this.message = ''; // Clear any previous message

    if (cmd === 'select-initial') {
      this.selectionMode = true;
      this.selectionModeChanged.emit(true);
      this.defineSpecMode = false;
      if (this.definePathMode) {
        this.definePathMode = false;
        this.definePathModeChanged.emit(false);
      }
    } else if (cmd === 'define-spec') {
      this.selectionMode = false;
      this.selectionModeChanged.emit(false);
      this.defineSpecMode = true;
      if (this.definePathMode) {
        this.definePathMode = false;
        this.definePathModeChanged.emit(false);
      }
      this.currentSpecIndex = 0;
      this.specInputs = this.confirmedPoints.map(() => ({ speed: 0, height: 0 }));
      this.specSpeed = '';
      this.specHeight = '';
    } else if (cmd === 'define-path') {
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
    } else if (cmd === 'confirm-details') {
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
  }

  // Add this helper method to your class:
  getAllDetails(): string {
    let msg = '';
    msg += `Confirmed Points:\n`;
    this.confirmedPoints.forEach((pt, i) => {
      msg += `  ${i + 1}: lat=${pt.lat}, lon=${pt.lon}, elev=${pt.elevation}\n`;
    });

    if (this.specInputs.length) {
      msg += `\nSpecs:\n`;
      this.specInputs.forEach((spec, i) => {
        msg += `  Point ${i + 1}: speed=${spec.speed}, height=${spec.height}\n`;
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

  // Called by parent when a path point is selected on DEM
  addPathPoint(point: { lat: number; lon: number; elevation: number }) {
    if (this.definePathMode) {
      this.currentPath.push(point);
      // Update the path in the paths array
      this.paths[this.currentPathIndex].path = [...this.currentPath];
      // Emit the updated paths to the parent
      this.pathsChanged.emit([...this.paths]);
      console.log('Path point added:', point, 'Current paths:', this.paths);
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
      this.pathsChanged.emit([...this.paths]);
      console.log('All paths:', this.paths);
    }
  }

  onPathRedo() {
    this.currentPath = [];
  }

  onSpecDone() {
    if (!this.specSpeed || !this.specHeight) return;
    this.specInputs[this.currentSpecIndex] = {
      speed: Number(this.specSpeed),
      height: Number(this.specHeight)
    };
    if (this.currentSpecIndex < this.confirmedPoints.length - 1) {
      this.currentSpecIndex++;
      this.specSpeed = '';
      this.specHeight = '';
    } else {
      const result = this.confirmedPoints.map((pt, i) => ({
      ...pt,
      speed: this.specInputs[i].speed,
      height: this.specInputs[i].height
    }));
      // All specs entered, handle as needed (emit, save, etc)
      this.defineSpecMode = false;
      console.log('All specs:', result);
    }
  }

  onSpecRedo() {
    if (this.currentSpecIndex > 0) {
      this.currentSpecIndex--;
      // Load the previous values into the input fields
      const prev = this.specInputs[this.currentSpecIndex];
      this.specSpeed = prev.speed ? String(prev.speed) : '';
      this.specHeight = prev.height ? String(prev.height) : '';
    }
  }

  hardReset() {
    // Clear all state
    this.confirmedPoints = [];
    this.specInputs = [];
    this.specSpeed = '';
    this.specHeight = '';
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
    this.pathsChanged.emit([...this.paths]);
    this.pointReset.emit();
  }

  onConfirmDetailsDone() {
    // For now, just clear the message and do nothing else
    this.message = '';
  }

  confirmPoint() {
    if (this.selectedPoint) {
      this.pointConfirmed.emit(this.selectedPoint);
    }
  }

  resetPoint() {
    this.pointReset.emit();
  }
}




