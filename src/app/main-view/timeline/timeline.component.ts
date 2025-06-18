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
  @Input() segmentLength: number = 10;

  simulation: SimulatedPoint[] = [];
  currentTime: number = 0;
  maxTime: number = 0;
  

  ngOnInit(): void {}

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

    console.log(`Getting elevation for lon: ${lon}, lat: ${lat}`);
    console.log("tiepointX:", tiepointX, "tiepointY:", tiepointY);
    console.log("pixelSizeX:", pixelSizeX, "pixelSizeY:", pixelSizeY);
    console.log("width:", width, "height:", height);

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
      return NaN; // Return NaN for out of bounds
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

  interpolatePoints(p1: { lon: number, lat: number }, p2: { lon: number, lat: number }, distance: number, segmentLength: number): { lon: number, lat: number }[] {
    console.log(`Interpolating points from (${p1.lon}, ${p1.lat}) to (${p2.lon}, ${p2.lat}) over distance ${distance} with segment length ${segmentLength}`);
    const segments = Math.ceil(distance / segmentLength);
    const result: { lon: number, lat: number }[] = [];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      result.push({
        lon: p1.lon + t * (p2.lon - p1.lon),
        lat: p1.lat + t * (p2.lat - p1.lat)
      });
    }
    return result;
  }

  getSpeedFactorUphill(angle: number): number {
    if (angle >= 45) return 0;
    if (angle > 40) return 0.4;
    if (angle > 30) return 0.5;
    if (angle > 20) return 0.6;
    if (angle > 10) return 0.7;
    return 0.4; // remove this function, fix the effective speed operation
  }

  getSpeedFactorDownhill(angle: number): number {
    if (angle >= 45) return 0;
    if (angle > 40) return 0.7;
    if (angle > 30) return 0.6;
    if (angle > 20) return 0.5;
    if (angle > 10) return 0.4;
    return 0.4;
  }

  simulateMovement(details: PointData[]): SimulatedPoint[] {
    const result: SimulatedPoint[] = [];//initialize result array

    console.log(`Simulating movement for ${details.length} points`);

    details.forEach((point, idx) => {
      console.log(`--- Simulating Point ${idx} ---`); // ONe point at a time
      let timeOffset = 0;
      let stopped = false;
      let prev = point.start;

      const elevationStart = this.getElevation(prev.lon, prev.lat);
      const simPath: SimulatedPathPoint[] = [{
        lon: prev.lon,
        lat: prev.lat,
        timeOffset: 0,
        effectiveSpeed: point.speed
      }];

      let lastElevation = elevationStart;
      const fullPath = [point.start, ...point.path];
      console.log("segmentLength is: ", this.segmentLength , "m");

      for (let i = 0; i < fullPath.length - 1; i++) {
        const start = fullPath[i];
        const end = fullPath[i + 1];
        const distance = this.haversine(start.lat, start.lon, end.lat, end.lon);
        const segments = this.interpolatePoints(start, end, distance, this.segmentLength);
        let segmentStart = start;

        for (const segmentEnd of segments) {
          const segmentDistance = this.haversine(segmentStart.lat, segmentStart.lon, segmentEnd.lat, segmentEnd.lon);
          const elevationEnd = this.getElevation(segmentEnd.lon, segmentEnd.lat);

          const elevationDiff = elevationEnd - lastElevation;
          const angle = Math.abs(Math.atan2(elevationDiff, segmentDistance) * 180 / Math.PI);

          let factor: number;
          if (elevationDiff >= 0) {
            factor = this.getSpeedFactorUphill(angle);
          } else {
            factor = this.getSpeedFactorDownhill(angle);
          }

          console.log(`Segment Distance: ${segmentDistance} meters, Elevation Diff: ${elevationDiff}, Angle: ${angle}`);

          if (factor === 0) {
            console.log(`Stopping Point ${idx} due to slope`);
            stopped = true;
            simPath.push({
              lon: segmentStart.lon,
              lat: segmentStart.lat,
              timeOffset: timeOffset,
              effectiveSpeed: 0
            });
            break;
          }

          const effectiveSpeed = point.speed * factor;
          const timeToNext = segmentDistance / effectiveSpeed;
          timeOffset += timeToNext;

          simPath.push({
            lon: segmentEnd.lon,
            lat: segmentEnd.lat,
            timeOffset: timeOffset,
            effectiveSpeed: effectiveSpeed
          });

          lastElevation = elevationEnd;
          segmentStart = segmentEnd;
        }

        if (stopped) break;
      }

      console.log(`Total time for Point ${idx}: ${timeOffset} seconds`);

      result.push({
        id: idx,
        path: simPath,
        stopped
      });
    });

    return result;
  }

  startSimulation(input: PointData[] | { details: PointData[], segmentSize: number }) {

    // this.simulation = [];
    // this.currentTime = 0;
    // this.maxTime = 0;

    console.log('🔄 Starting simulation with input:', input);

    let details: PointData[] = [];
    let segmentSize = this.segmentLength;

    if (input && typeof input === 'object' && 'details' in input && 'segmentSize' in input) {
      details = input.details;
      segmentSize = input.segmentSize;
    } else if (Array.isArray(input)) {
      details = input;
    } else {
      console.warn("⚠️ Invalid simulation input format:", input);
      return;
    }

    this.segmentLength = segmentSize;

    console.log('🚀 Starting simulation with:', {
      segmentLength: this.segmentLength,
      details
    });

    this.simulation = this.simulateMovement(details);
    console.log('✅ Simulation complete:', this.simulation);

    if (this.simulation.length === 0) {
      console.warn("⚠️ No points simulated.");
      this.maxTime = 0;
    } else {
      this.maxTime = Math.max(...this.simulation.flatMap(p => p.path.map(pt => pt.timeOffset)));
    }

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

        console.log(`Interpolated Position - ID ${point.id}: Lon ${interpolatedLon}, Lat ${interpolatedLat}`);

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

