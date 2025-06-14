import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-select-initial-points',
  templateUrl: './select-initial-points.component.html',
  styleUrls: ['./select-initial-points.component.css']
})
export class SelectInitialPointsComponent {
  @Output() done = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();

  selectedPoints: any[] = [];

  // Don't remember why this exists, but it does
  addPoint(point: any) {
    this.selectedPoints.push(point);
  }

  onRedoClick() {
    this.selectedPoints = [];
    this.redo.emit();
  }

  onDoneClick() {
    if (this.selectedPoints.length > 0) {
      this.done.emit();
    }
  }
}

