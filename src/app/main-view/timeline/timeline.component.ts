import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { DemDataService } from 'src/app/services/dem-data.service';

interface PointData {
  start: { lon: number; lat: number };
  path: { lon: number; lat: number }[];
  speed: number;
}

interface SimulatedPathPoint {
  lon: number;
  lat: number;
  timeOffset: number;
  effectiveSpeed: number;
  slopeType?: 'uphill' | 'downhill';
  color?: string;
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
export class TimelineComponent implements OnInit {
  constructor(private demDataService: DemDataService) {}

  @Output() positionsChanged = new EventEmitter<{ lon: number, lat: number, id: number }[]>();
  @Input() segmentCount: number = 10;

  simulation: SimulatedPoint[] = [];
  currentTime: number = 0;
  maxTime: number = 0;

  ngOnInit(): void {}

  clearSimulation(): void {
    this.simulation = [];
    this.currentTime = 0;
    this.maxTime = 0;
    this.emitPositions();
  }

  getElevation(lon: number, lat: number): number {
    const epsilon = 1e-8;
    const {
      rasterData,
      width,
      height,
      tiepointX,
      tiepointY,
      pixelSizeX,
      pixelSizeY,
    } = this.demDataService;

    const minLon = tiepointX;
    const maxLon = tiepointX + (width - 1) * pixelSizeX;
    const maxLat = tiepointY;
    const minLat = tiepointY - (height - 1) * pixelSizeY;

    const clampedLon = Math.min(Math.max(lon, minLon - epsilon), maxLon + epsilon);
    const clampedLat = Math.min(Math.max(lat, minLat - epsilon), maxLat + epsilon);

    const col = Math.floor((clampedLon - tiepointX) / pixelSizeX);
    const row = Math.floor((tiepointY - clampedLat) / pixelSizeY);

    console.log(`minLon ${minLon}, maxLon ${maxLon}, minLat ${minLat}, maxLat ${maxLat}`);
    console.log(`clampedLon ${clampedLon}, clampedLat ${clampedLat}`);
    console.log(`row ${row}, col ${col}`);

    if (col < 0 || col >= width || row < 0 || row >= height) {
      console.warn(`Out of bounds DEM sampling at (${lon}, ${lat})`);
      return NaN;
    }

    const index = row * width + col;
    console.log(`Elevation at index ${index}: ${rasterData[index]}`);
    return rasterData[index];
  }

  haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  interpolateEntirePath(points: { lon: number; lat: number }[], totalSegments: number): { lon: number; lat: number }[] {
    const distances: number[] = [];
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const d = this.haversine(points[i].lat, points[i].lon, points[i + 1].lat, points[i + 1].lon);
      distances.push(d);
      totalDistance += d;
    }

    const result: { lon: number; lat: number }[] = [points[0]];
    let accumulatedSegments = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const idealSegments = (distances[i] / totalDistance) * totalSegments;
      let segmentCount = Math.round(idealSegments);

      // Final adjustment to hit exactly totalSegments
      if (i === points.length - 2) {
        segmentCount = totalSegments - accumulatedSegments;
      }

      for (let j = 1; j <= segmentCount; j++) {
        const t = j / segmentCount;
        result.push({
          lon: p1.lon + t * (p2.lon - p1.lon),
          lat: p1.lat + t * (p2.lat - p1.lat),
        });
      }

      accumulatedSegments += segmentCount;
    }

    return result;
  }


  getSpeedFactorUphill(angle: number): number {
    if (angle >= 45) return 0;
    if (angle > 40) return 0.4;
    if (angle > 30) return 0.5;
    if (angle > 20) return 0.6;
    if (angle > 10) return 0.7;
    return 0.4;
  }

  getSpeedFactorDownhill(angle: number): number {
    if (angle >= 45) return 0;
    if (angle > 40) return 0.7;
    if (angle > 30) return 0.6;
    if (angle > 20) return 0.5;
    if (angle > 10) return 0.4;
    return 0.4;
  }

  getSlopeType(elevationDiff: number): 'uphill' | 'downhill' {
    return elevationDiff >= 0 ? 'uphill' : 'downhill';
  }

  getSlopeColor(elevationDiff: number): string {
    return elevationDiff >= 0 ? '#FF5733' : '#00FF00';
  }

  simulateMovement(details: PointData[]): SimulatedPoint[] {
    return details.map((point, idx) => {
      let timeOffset = 0;
      let stopped = false;
      const fullPath = [point.start, ...point.path];
      const interpolated = this.interpolateEntirePath(fullPath, this.segmentCount);
      const simPath: SimulatedPathPoint[] = [];
      let lastElevation = this.getElevation(interpolated[0].lon, interpolated[0].lat);

      simPath.push({
        lon: interpolated[0].lon,
        lat: interpolated[0].lat,
        timeOffset,
        effectiveSpeed: point.speed,
      });

      for (let i = 1; i < interpolated.length; i++) {
        const prev = interpolated[i - 1];
        const curr = interpolated[i];
        const distance = this.haversine(prev.lat, prev.lon, curr.lat, curr.lon);
        const elevation = this.getElevation(curr.lon, curr.lat);

        if (isNaN(elevation)) {
          console.warn(`Skipping segment due to invalid elevation at (${curr.lon}, ${curr.lat})`);
          continue;
        }

        const elevationDiff = elevation - lastElevation;
        const angle = Math.abs(Math.atan2(elevationDiff, distance) * 180 / Math.PI);

        let factor = elevationDiff >= 0 ? this.getSpeedFactorUphill(angle) : this.getSpeedFactorDownhill(angle);
        if (factor === 0) {
          stopped = true;
          simPath.push({ lon: prev.lon, lat: prev.lat, timeOffset, effectiveSpeed: 0, slopeType: this.getSlopeType(elevationDiff), color: this.getSlopeColor(elevationDiff) });
          break;
        }

        const effectiveSpeed = point.speed * factor;
        const timeToNext = distance / effectiveSpeed;
        timeOffset += timeToNext;

        simPath.push({
          lon: curr.lon,
          lat: curr.lat,
          timeOffset,
          effectiveSpeed,
          slopeType: this.getSlopeType(elevationDiff),
          color: this.getSlopeColor(elevationDiff)
        });

        lastElevation = elevation;
      }

      return { id: idx, path: simPath, stopped };
    });
  }

  startSimulation(input: PointData[] | { details: PointData[], segmentSize: number }) {
    let details: PointData[] = [];
    let segmentSize = this.segmentCount;

    if ('details' in input && 'segmentSize' in input) {
      details = input.details;
      segmentSize = input.segmentSize;
    } else if (Array.isArray(input)) {
      details = input;
    } else {
      console.warn("Invalid simulation input format", input);
      return;
    }

    this.segmentCount = segmentSize;
    this.simulation = this.simulateMovement(details);
    this.maxTime = this.simulation.length === 0 ? 0 : Math.max(...this.simulation.flatMap(p => p.path.map(pt => pt.timeOffset)));
    this.currentTime = 0;
    this.emitPositions();
  }

  getCurrentPositions(): { lon: number, lat: number, id: number }[] {
    return this.simulation.map(point => {
      const idx = point.path.findIndex(p => p.timeOffset > this.currentTime);
      if (idx === -1) {
        const last = point.path[point.path.length - 1];
return { lon: last.lon, lat: last.lat, id: point.id };
} else if (idx === 0) {
        const first = point.path[0];
        return { lon: first.lon, lat: first.lat, id: point.id };
} else {
      const prev = point.path[idx - 1];
      const next = point.path[idx];
      let t = (this.currentTime - prev.timeOffset) / (next.timeOffset - prev.timeOffset);
        const clampedT = Math.min(Math.max(t, 0), 1);
      const interpolatedLon = prev.lon + (next.lon - prev.lon) * clampedT;
        const interpolatedLat = prev.lat + (next.lat - prev.lat) * clampedT;

        return { lon: interpolatedLon, lat: interpolatedLat, id: point.id };
      }
    });
  }

  onTimeChange() {
    this.emitPositions();
  }

  emitPositions() {
    this.positionsChanged.emit(this.getCurrentPositions());
  }

  formatTime(seconds: number): string {
    const totalSeconds = Math.floor(seconds);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }
}



