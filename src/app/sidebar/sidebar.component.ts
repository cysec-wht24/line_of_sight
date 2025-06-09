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
        this.definePathModeChanged.emit(false); // <-- Add this!
      }
    } else if (cmd === 'define-spec') {
      this.selectionMode = false;
      this.selectionModeChanged.emit(false);
      this.defineSpecMode = true;
      if (this.definePathMode) {
        this.definePathMode = false;
        this.definePathModeChanged.emit(false); // <-- Add this!
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

  // Called by parent when a path point is selected on DEM
  addPathPoint(point: { lat: number; lon: number; elevation: number }) {
    if (this.definePathMode) {
      this.currentPath.push(point);
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

  confirmPoint() {
    if (this.selectedPoint) {
      this.pointConfirmed.emit(this.selectedPoint);
    }
  }

  resetPoint() {
    this.pointReset.emit();
  }
}




