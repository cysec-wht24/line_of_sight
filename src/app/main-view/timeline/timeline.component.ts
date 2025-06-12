import { Component, Output, EventEmitter, Input } from '@angular/core';

interface PointData {
  id: number;
  initialPoint: { x: number; y: number };
  height: number; // meters
  speed: number;  // m/s
  path: { x: number; y: number }[];
}

interface SimulatedPathPoint {
  x: number;
  y: number;
  timeOffset: number; // seconds from start
  effectiveSpeed: number;
}

interface SimulatedPoint {
  id: number;
  path: SimulatedPathPoint[];
  stopped: boolean;
}

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.css']
})
export class TimelineComponent {

  @Output() positionsChanged = new EventEmitter<{ x: number, y: number, id: number }[]>();

  @Input() rasterData: number[] = [];
  @Input() width: number = 0;
  @Input() height: number = 0;
  @Input() tiepointX: number = 0;
  @Input() tiepointY: number = 0;
  @Input() pixelSizeX: number = 1;
  @Input() pixelSizeY: number = 1;

  simulation: SimulatedPoint[] = [];
  currentTime: number = 0;
  maxTime: number = 0;

  getElevation(x: number, y: number): number {
    const col = Math.round((x - this.tiepointX) / this.pixelSizeX);
    const row = Math.round((this.tiepointY - y) / this.pixelSizeY);
    if (
      col >= 0 && col < this.width &&
      row >= 0 && row < this.height
    ) {
      const val = this.rasterData[row * this.width + col];
      console.log(`Elevation at (${x}, ${y}) [${col}, ${row}]: ${val}`);
      return val;
    }
    console.warn(`Out of bounds: (${x}, ${y}) [${col}, ${row}]`);
    return 0;
  }

  /**
   * Interpolates between two values.
   * Used for smooth degradation/acceleration calculation.
   */
  private interpolate(x: number, x0: number, x1: number, y0: number, y1: number): number {
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }

  /**
   * Handles degradation in uphill motion based on slope angle.
   */
  private getUphillFactor(angle: number): number {
    if (angle <= 10) return 0.8;
    if (angle <= 20) return 0.6;
    if (angle <= 30) return 0.7;
    if (angle <= 40) return 0.5;
    if (angle > 40 && angle <= 45) {
      return this.interpolate(angle, 40, 45, 0.5, 0);
    }
    return 0; // Unreachable, > 45° handled in main loop
  }

  /**
   * Handles acceleration in downhill motion based on slope angle.
   */
  private getDownhillFactor(angle: number): number {
    if (angle <= 10) return 1.25;
    if (angle <= 20) return 1.3;
    if (angle <= 30) return 1.4;
    if (angle <= 40) return 1.5;
    if (angle > 40) return 1.6; // Cap acceleration
    return 1; // Fallback
  }

  /**
   * Main simulation function: Simulates movement over terrain.
   */
  simulateMovement(data: PointData[]): SimulatedPoint[] {
    const result: SimulatedPoint[] = [];

    for (const point of data) {
      let stopped = false;
      let timeOffset = 0;
      let prev = point.initialPoint;
      const elevationStart = this.getElevation(prev.x, prev.y);
      const prevElevation = typeof elevationStart === 'number' ? elevationStart + point.height : point.height;

      const simPath: SimulatedPathPoint[] = [{
        x: prev.x,
        y: prev.y,
        timeOffset: 0,
        effectiveSpeed: point.speed
      }];

      let lastElevation = prevElevation;

      for (let i = 0; i < point.path.length; i++) {
        const next = point.path[i];

        const rawElevation = this.getElevation(next.x, next.y);
        const nextElevation = typeof rawElevation === 'number' ? rawElevation + point.height : point.height;

        const dx = next.x - prev.x;
        const dy = next.y - prev.y;

        // ⚠️ Potential Issue #1: Handle zero-distance case
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0) {
          console.warn(`Point ${point.id} at index ${i} has zero distance. Skipping.`);
          continue;
        }

        const elevationDiff = nextElevation - lastElevation;
        const angleRad = Math.atan2(elevationDiff, distance);
        const angleDeg = Math.abs(angleRad * 180 / Math.PI);
        const uphill = elevationDiff > 0;

        let factor = 1;
        if (uphill) {
          if (angleDeg > 45) {
            console.warn(`Point ${point.id} stopped at index ${i} due to slope > 45°`);
            stopped = true;

            // ⚠️ Potential Issue #2: Add last reachable point
            simPath.push({
              x: prev.x,
              y: prev.y,
              timeOffset,
              effectiveSpeed: 0
            });
            break;
          }
          factor = this.getUphillFactor(angleDeg);
        } else {
          factor = this.getDownhillFactor(angleDeg);
        }

        factor = Number(factor.toFixed(4)); // ✅ Suggestion #4
        const effectiveSpeed = point.speed * factor;
        const timeToNext = effectiveSpeed > 0 ? distance / effectiveSpeed : 0;
        timeOffset += timeToNext;

        // ✅ Suggestion #4: Detailed logs for each segment
        console.log(
          `Point ${point.id} Step ${i} → angle: ${angleDeg.toFixed(2)}°, ` +
          `elevationDiff: ${elevationDiff.toFixed(2)}m, speed factor: ${factor}, ` +
          `effectiveSpeed: ${effectiveSpeed.toFixed(2)} m/s, timeOffset: ${timeOffset.toFixed(2)}s`
        );

        simPath.push({
          x: next.x,
          y: next.y,
          timeOffset,
          effectiveSpeed
        });

        prev = next;
        lastElevation = nextElevation;
      }

      result.push({
        id: point.id,
        path: simPath,
        stopped
      });
    }

    return result;
  }

  startSimulation(details: any) {
    const data: PointData[] = details.map((d: any, idx: number) => ({
      id: idx,
      initialPoint: { x: d.start.lon, y: d.start.lat },
      height: d.height,
      speed: d.speed,
      path: d.path.map((pt: any) => ({ x: pt.lon, y: pt.lat }))
    }));

    this.simulation = this.simulateMovement(data);
    this.maxTime = Math.max(...this.simulation.flatMap(p => p.path.map(pt => pt.timeOffset)));
    console.log('Simulation:', this.simulation);
    console.log('maxTime:', this.maxTime);
    this.currentTime = 0;
    this.emitPositions();
  }

  getCurrentPositions(): { x: number, y: number, id: number }[] {
    return this.simulation.map(point => {
      const idx = point.path.findIndex(pt => pt.timeOffset > this.currentTime);
      if (idx === -1) {
        const last = point.path[point.path.length - 1];
        return { x: last.x, y: last.y, id: point.id };
      } else if (idx === 0) {
        const first = point.path[0];
        return { x: first.x, y: first.y, id: point.id };
      } else {
        const prev = point.path[idx - 1];
        const next = point.path[idx];
        const t = (this.currentTime - prev.timeOffset) / (next.timeOffset - prev.timeOffset);
        return {
          x: prev.x + (next.x - prev.x) * t,
          y: prev.y + (next.y - prev.y) * t,
          id: point.id
        };
      }
    });
  }

  onTimeChange() {
    this.emitPositions();
  }

  formatTime(seconds: number): string {
    seconds = Math.floor(seconds); // Ensure integer seconds
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${days}d ${hours}h ${mins}m ${secs}s`;
  }

  emitPositions() {
    this.positionsChanged.emit(this.getCurrentPositions());
  }

}

