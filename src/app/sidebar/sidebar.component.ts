import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() selectedPoint: { lat: number; lon: number; elevation: number } | null = null;
  @Input() confirmedPoints: { lat: number; lon: number; elevation: number }[] = [];

  @Output() pointConfirmed = new EventEmitter<{ lat: number; lon: number; elevation: number }>();
  @Output() pointReset = new EventEmitter<void>();
  @Output() selectionModeChanged = new EventEmitter<boolean>();

 
  commandInput: string = '';
  selectionMode: boolean = false;
  defineSpecMode: boolean = false;
  currentSpecIndex: number = 0;
  specInputs: { speed: number; height: number }[] = [];
  specSpeed: string = '';
  specHeight: string = '';

  processCommand() {
    const cmd = this.commandInput.trim();
    if (cmd === 'select-initial-points') {
      this.selectionMode = true;
      this.selectionModeChanged.emit(true);
      this.defineSpecMode = false;
    } else if (cmd === 'define-spec') {
      this.selectionMode = false;
      this.selectionModeChanged.emit(false);
      this.defineSpecMode = true;
      this.currentSpecIndex = 0;
      this.specInputs = this.confirmedPoints.map(() => ({ speed: 0, height: 0 }));
      this.specSpeed = '';
      this.specHeight = '';
    } else {
      this.selectionMode = false;
      this.selectionModeChanged.emit(false);
      this.defineSpecMode = false;
    }
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
    this.specSpeed = '';
    this.specHeight = '';
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




