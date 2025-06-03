import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() selectedPoint: { lat: number; lon: number; elevation: number } | null = null;

  @Output() pointConfirmed = new EventEmitter<{ lat: number; lon: number; elevation: number }>();
  @Output() pointReset = new EventEmitter<void>();

  confirmPoint() {
    if (this.selectedPoint) {
      this.pointConfirmed.emit(this.selectedPoint);
    }
  }

  resetPoint() {
    this.pointReset.emit();
  }
}




