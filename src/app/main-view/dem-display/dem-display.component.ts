import { 
  Component, 
  ElementRef, 
  ViewChild, 
  AfterViewInit, 
  HostListener, 
  Output, 
  EventEmitter, 
  Input, 
  OnChanges, 
  SimpleChanges,
} from '@angular/core';
import { fromArrayBuffer } from 'geotiff';
import { DemDataService } from 'src/app/services/dem-data.service';

@Component({
  selector: 'app-dem-display',
  templateUrl: './dem-display.component.html',
  styleUrls: ['./dem-display.component.css']
})

export class DemDisplayComponent implements AfterViewInit, OnChanges {

  constructor(private demDataService: DemDataService) {}

  @ViewChild('demCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() deletedPointIndex: number | null = null;
  @Input() initialPoints: { lat: number; lon: number; elevation: number }[] = [];
  @Input() confirmedPoints: Array<{ lat: number; lon: number; elevation: number; speed: number }> = [];
  @Input() selectionMode: boolean = false;
  @Input() definePathMode: boolean = false;
  @Input() paths: Array<{
    start: { lat: number; lon: number; elevation: number };
    path: { lat: number; lon: number; elevation: number }[];
  }> = [];
  @Input() currentPath: any[] = [];
  @Input() currentPathIndex: number = 0;
  @Input() movingPoints: { x: number; y: number; id: number }[] = []; // animated blue markers
  @Input() slopeColoredSimulation: any[] = [];
  
  @Output() pointSelected = new EventEmitter<{ lat: number; lon: number; elevation: number }>();
  @Output() pathPointSelected = new EventEmitter<{ lat: number; lon: number; elevation: number }>();

  private resizeObserver!: ResizeObserver;

  private rasterData!: Float32Array;
  private width!: number;
  private height!: number;
  private minElevation!: number;
  private maxElevation!: number;

  // 🆕 Tooltip-related state
  hoverInfo = {
  x: 0,
  y: 0,
  elevation: 0,
  lon: 0,
  lat: 0,
  visible: false
  };

  private currentScale = 1; // 🆕 Used to map scaled canvas coords to original raster

  // 🆕 GeoTIFF tiepoint and pixel scale (geo referencing)
  private tiepointX = 0;
  private tiepointY = 0;
  private pixelSizeX = 1;
  private pixelSizeY = 1;

  // async ngAfterViewInit(): Promise<void> {     
  //   await this.loadDEM();     
  //   this.resizeAndRender();   
  // }

  private shouldRender = false;

  // Angular lifecycle hook that responds to input property changes
  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['confirmedPoints'] ||
      changes['paths'] ||
      changes['movingPoints'] ||
      changes['initialPoints']
    ) {
      if (this.canvasRef?.nativeElement) {
        this.resizeAndRender();
      } else {
        this.shouldRender = true; // later will be used to complete pending render
      }
    }

    // 🔴 Handle deletedPointIndex change here:
    if (changes['deletedPointIndex'] && changes['deletedPointIndex'].currentValue !== null) {
      const index = changes['deletedPointIndex'].currentValue;
      this.removeVisualsForDeletedPoint(index);
    }
  }

  // Angular lifecycle hook called after the component’s view is initialized
  ngAfterViewInit(): void {
    this.loadDEM().then(() => {
      this.observeResizeAndRender();

      // Perform pending render if needed
      if (this.shouldRender) {
        this.resizeAndRender();
        this.shouldRender = false;
      }
    });
  }

  // Observes canvas container resize and triggers re-render
  observeResizeAndRender(): void {
  const canvasParent = this.canvasRef.nativeElement.parentElement;

  if (!canvasParent) return;

  this.resizeObserver = new ResizeObserver(() => {
    this.resizeAndRender();
  });
  this.resizeObserver.observe(canvasParent);
  }

  // Angular lifecycle hook for cleanup when component is destroyed
  ngOnDestroy(): void {
  if (this.resizeObserver) {
    this.resizeObserver.disconnect();
  }
  }

  @HostListener('window:resize')
  onResize() {
    this.resizeAndRender();
  }

  // Removes a point and its related visuals (path, confirmed and initial point) from the display using its index.
  // Resets current path if it was the one deleted.
  // Triggers a re-render of the canvas.
  removeVisualsForDeletedPoint(index: number): void {
    // Remove path and point by index
    this.paths.splice(index, 1);
    this.confirmedPoints.splice(index, 1);
    this.initialPoints.splice(index, 1);

    // Reset if the currentPath belongs to the deleted index
    if (this.currentPathIndex === index) {
      this.currentPath = [];
      this.currentPathIndex = -1;
    }

    // Re-render
    this.resizeAndRender();
  }

  // Handles canvas click to select a point based on current mode (selection or definePath).
  // Converts click coordinates to raster index and emits selected lat/lon/elevation info.
  onCanvasClick(event: MouseEvent) {
    // Only allow selection in selection or definePath mode
    if (!this.selectionMode && !this.definePathMode) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const origX = Math.floor(x / this.currentScale);
    const origY = Math.floor(y / this.currentScale);
    const i = origY * this.width + origX;

    console.log('Canvas click:', { x, y, origX, origY, i });
    
    if (i >= 0 && i < this.rasterData.length) {
      const val = this.rasterData[i];
      if (val !== 0) {
        const lon = this.tiepointX + origX * this.pixelSizeX;
        const lat = this.tiepointY - origY * this.pixelSizeY;

        if (this.definePathMode) {
          this.pathPointSelected.emit({ lat, lon, elevation: val });
          console.log('Canvas click:', { x, y, origX, origY, i });
        } else if (this.selectionMode) {
          this.pointSelected.emit({ lat, lon, elevation: val });
          console.log('Canvas click:', { x, y, origX, origY, i });
        }
      }
    }
  }

  // Displays a tooltip with lat/lon/elevation when the mouse moves over the canvas.
  // Handles pixel-to-geographic coordinate conversion for the tooltip.
  onMouseMove(event: MouseEvent) {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const origX = Math.floor(x / this.currentScale);
    const origY = Math.floor(y / this.currentScale);
    const i = origY * this.width + origX;

    if (i >= 0 && i < this.rasterData.length) {
      const val = this.rasterData[i];
      if (val !== 0) {
        // Convert pixel to geo coordinates
        const lon = this.tiepointX + origX * this.pixelSizeX;
        const lat = this.tiepointY - origY * this.pixelSizeY;

        // Tooltip box approximate size (adjust if you change styles)
        const tooltipWidth = 150;
        const tooltipHeight = 70;
        let tooltipX = x + 10;
        let tooltipY = y + 10;

        // Keep tooltip inside right edge of canvas
        if (tooltipX + tooltipWidth > canvas.width) {
          tooltipX = x - tooltipWidth - 10;
        }
        // Keep tooltip inside bottom edge of canvas
        if (tooltipY + tooltipHeight > canvas.height) {
          tooltipY = y - tooltipHeight - 10;
        }

        this.hoverInfo = {
          x: tooltipX,
          y: tooltipY,
          elevation: val,
          lon,
          lat,
          visible: true
        };
        return;
      }
    }

    this.hoverInfo.visible = false;
  }


  // 🆕 Hide tooltip when leaving canvas
  onMouseLeave() {
    this.hoverInfo.visible = false;
  }

  // Fetches a DTED file from URL and extracts tiepoint coordinates (lat/lon origin).
  // Parses ASCII header to determine starting geographic coordinates.
  // Converts DMS (degree, minute, second) format to decimal degrees.
  private async extractTiepointsFromDTED(
    url: string
  ): Promise<{ arrayBuffer: ArrayBuffer; tiepointX: number; tiepointY: number }> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    console.log('[DTED] Fetched array buffer of size:', arrayBuffer.byteLength);

    const decoder = new TextDecoder("ascii");

    const rawLonStr = decoder.decode(arrayBuffer.slice(4, 13));   // e.g. 0770000E0
    const rawLatStr = decoder.decode(arrayBuffer.slice(13, 22));  // e.g. 250000N00

    console.log('[DTED] Raw lonStr:', rawLonStr, '| latStr:', rawLatStr);

    // Use regex to extract valid DMS + hemisphere parts
    const lonMatch = rawLonStr.match(/(\d{3})(\d{2})(\d{2})([EW])/);
    const latMatch = rawLatStr.match(/(\d{2})(\d{2})(\d{2})([NS])/);

    if (!lonMatch || !latMatch) {
      console.error('[DTED] Failed to extract DMS from header.');
      return { arrayBuffer, tiepointX: NaN, tiepointY: NaN };
    }

    const lonDMS = lonMatch.slice(1, 5); // [deg, min, sec, hemi]
    const latDMS = latMatch.slice(1, 5);

    const tiepointX = dmsToDecimal(lonMatch[1], lonMatch[2], lonMatch[3], lonMatch[4]);
    const tiepointY = dmsToDecimal(latMatch[1], latMatch[2], latMatch[3], latMatch[4]);

    console.log('[DTED] Extracted Tiepoints -> X:', tiepointX, 'Y:', tiepointY);

    return { arrayBuffer, tiepointX, tiepointY };

    // Convert DMS (degree, minute, second, hemisphere) to decimal
    function dmsToDecimal(deg: string, min: string, sec: string, hemi: string): number {
      let decimal = parseInt(deg, 10) + parseInt(min, 10) / 60 + parseInt(sec, 10) / 3600;
      if (hemi === 'W' || hemi === 'S') decimal *= -1;
      return decimal;
    }
  }

  // Loads and parses the DTED file to extract elevation data into a Float32Array.
  // Computes metadata: width, height, min/max elevation.
  // Saves data to DemDataService for use in other components.
  private async loadDEM() {
    const { arrayBuffer, tiepointX, tiepointY } = await this.extractTiepointsFromDTED('assets/n25_e077_converted.dt1');
    const dataView = new DataView(arrayBuffer);

    const HEADER_SIZE = 3428;
    const LAT_POINTS = 1201;
    const LON_POINTS = 1201;
    const COLUMN_SIZE = 8 + LAT_POINTS * 2 + 4;
    const NODATA = -32767;

    const expectedSize = HEADER_SIZE + LON_POINTS * COLUMN_SIZE;
    console.log('[DTED] Expected buffer size:', expectedSize);
    if (arrayBuffer.byteLength < expectedSize) {
      console.error('[DTED] DTED file is too small or corrupted.');
      return;
    }

    const elevationData = new Float32Array(LAT_POINTS * LON_POINTS);
    console.log('[DTED] Starting elevation extraction...');
    let offset = HEADER_SIZE;

    for (let col = 0; col < LON_POINTS; col++) {
      const columnStart = offset + col * COLUMN_SIZE + 8;
      for (let row = 0; row < LAT_POINTS; row++) {
        const index = row * LON_POINTS + col;
        const valOffset = columnStart + row * 2;
        const elevation = dataView.getInt16(valOffset, false);
        elevationData[index] = elevation;
      }
      if (col % 600 === 0) console.log(`[DTED] Processed column ${col}/${LON_POINTS}`);
    }

    this.width = LON_POINTS;
    this.height = LAT_POINTS;
    this.rasterData = elevationData;

    this.tiepointX = tiepointX;
    this.tiepointY = tiepointY;
    this.pixelSizeX = 3 / 3600;
    this.pixelSizeY = 3 / 3600;

    this.minElevation = Infinity;
    this.maxElevation = -Infinity;
    for (let i = 0; i < elevationData.length; i++) {
      const val = elevationData[i];
      if (val !== NODATA) {
        if (val < this.minElevation) this.minElevation = val;
        if (val > this.maxElevation) this.maxElevation = val;
      }
    }

    console.log('[DTED] Elevation range:', this.minElevation, 'to', this.maxElevation);

    // Save to service
    this.demDataService.rasterData = Array.from(this.rasterData);
    this.demDataService.width = this.width;
    this.demDataService.height = this.height;
    this.demDataService.tiepointX = this.tiepointX;
    this.demDataService.tiepointY = this.tiepointY;
    this.demDataService.pixelSizeX = this.pixelSizeX;
    this.demDataService.pixelSizeY = this.pixelSizeY;

    console.log('[DTED] DTED1 parsed successfully ✅');
  }

  // Adjusts canvas size based on its parent container.
  // Calculates appropriate scaling factor for fitting canvas content.
  // Calls renderToCanvas() with new dimensions.
  private resizeAndRender() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement!;
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;

    const scale = Math.min(parentWidth / this.width, parentHeight / this.height, 1);
    this.currentScale = scale; // 🆕 Save scale for hover logic

    const scaledWidth = Math.floor(this.width * scale);
    const scaledHeight = Math.floor(this.height * scale);

    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    
    this.renderToCanvas(scaledWidth, scaledHeight, scale);
  }

  // Renders the actual elevation data as grayscale image on the canvas.
  // Draws:
  // - Raster elevation grid
  // - Confirmed paths (red lines)
  // - Confirmed and in-progress path points (orange dots)
  // - Initial points (outlined red circles)
  // - Moving points (animated blue points with IDs)
  // - Slope-colored simulation paths (gradient lines with slope info)
  private renderToCanvas(scaledWidth: number, scaledHeight: number, scale: number) {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw DEM raster
    const imageData = ctx.createImageData(scaledWidth, scaledHeight);
    for (let y = 0; y < scaledHeight; y++) {
      for (let x = 0; x < scaledWidth; x++) {
        const origX = Math.floor(x / scale);
        const origY = Math.floor(y / scale);
        const i = origY * this.width + origX;
        const val = this.rasterData[i];
        const color = this.getColorForElevation(val, this.minElevation, this.maxElevation);
        const idx = (y * scaledWidth + x) * 4;
        imageData.data[idx + 0] = color.r;
        imageData.data[idx + 1] = color.g;
        imageData.data[idx + 2] = color.b;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw committed paths (red lines and orange points)
    if (this.paths?.length) {
      for (const pathObj of this.paths) {
        const start = pathObj.start;
        const path = pathObj.path;

        // Draw red line from start to each path point in order
        if (path.length > 0) {
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.beginPath();
          let prevX = (start.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
          let prevY = (this.tiepointY - start.lat) / this.pixelSizeY * this.currentScale;
          ctx.moveTo(prevX, prevY);

          for (const pt of path) {
            const x = (pt.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
            const y = (this.tiepointY - pt.lat) / this.pixelSizeY * this.currentScale;
            ctx.lineTo(x, y);
            prevX = x;
            prevY = y;
          }
          ctx.stroke();
        }

        // Draw orange dots for path points
        ctx.fillStyle = 'orange';
        for (const pt of path) {
          const x = (pt.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
          const y = (this.tiepointY - pt.lat) / this.pixelSizeY * this.currentScale;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }

    // Draw in-progress path (currentPath) if in definePathMode
    if (
      this.definePathMode &&
      this.currentPath &&
      this.currentPath.length > 0 &&
      this.confirmedPoints?.length > this.currentPathIndex
    ) {
      const start = this.confirmedPoints[this.currentPathIndex];
      let prevX = (start.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
      let prevY = (this.tiepointY - start.lat) / this.pixelSizeY * this.currentScale;
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);

      for (const pt of this.currentPath) {
        const x = (pt.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
        const y = (this.tiepointY - pt.lat) / this.pixelSizeY * this.currentScale;
        ctx.lineTo(x, y);
        prevX = x;
        prevY = y;
      }
      ctx.stroke();

      // Draw orange dots for in-progress path points
      ctx.fillStyle = 'orange';
      for (const pt of this.currentPath) {
        const x = (pt.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
        const y = (this.tiepointY - pt.lat) / this.pixelSizeY * this.currentScale;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw confirmed points as red dots (on top)
    if (this.confirmedPoints?.length) {
      ctx.fillStyle = 'red';
      for (const point of this.confirmedPoints) {
        const canvasX = (point.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
        const canvasY = (this.tiepointY - point.lat) / this.pixelSizeY * this.currentScale;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw initial points as red outlined circles (to distinguish from confirmed points)
    if (this.initialPoints?.length) {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      for (const point of this.initialPoints) {
        const canvasX = (point.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
        const canvasY = (this.tiepointY - point.lat) / this.pixelSizeY * this.currentScale;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI); // Slightly larger
        ctx.stroke(); // outlined circle
      }
    }

    // Draw moving points (from timeline animation)
    if (this.movingPoints?.length) {
      ctx.fillStyle = 'blue';
      for (const pt of this.movingPoints) {
        // Convert (x, y) to canvas coordinates (x = lon, y = lat)
        const canvasX = (pt.x - this.tiepointX) / this.pixelSizeX * this.currentScale;
        const canvasY = (this.tiepointY - pt.y) / this.pixelSizeY * this.currentScale;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI); // Larger radius for visibility
        ctx.fill();
        // Optionally, draw id
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.fillText(String(pt.id), canvasX - 3, canvasY + 3);
        ctx.fillStyle = 'blue';
      }
    }

    // ✅ Draw slope-colored simulation paths
    if (this.slopeColoredSimulation?.length) {
      for (const simPoint of this.slopeColoredSimulation) {
        const path = simPoint.path;
        for (let i = 0; i < path.length - 1; i++) {
          const current = path[i];
          const next = path[i + 1];
          const color = current.color || '#FFFFFF';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          const x1 = (current.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
          const y1 = (this.tiepointY - current.lat) / this.pixelSizeY * this.currentScale;
          const x2 = (next.lon - this.tiepointX) / this.pixelSizeX * this.currentScale;
          const y2 = (this.tiepointY - next.lat) / this.pixelSizeY * this.currentScale;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }
  }

  // Maps elevation value to grayscale color based on its position between min and max elevation.
  private getColorForElevation(elevation: number, min: number, max: number) {
    if (elevation === 0) {
      return { r: 0, g: 0, b: 0 };
    }
    const normalized = (elevation - min) / (max - min);
    const colorValue = Math.floor(normalized * 255);
    return {
      r: colorValue,
      g: colorValue,
      b: colorValue
    };
  }

  // Clears all user-drawn visuals: confirmed points, paths, animations, etc.
  // Triggers canvas re-render.
  clearDisplay(): void {
    console.log('🧼 Clearing DEM display visuals');

    this.confirmedPoints = [];
    this.initialPoints = [];
    this.paths = [];
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.movingPoints = [];
    this.slopeColoredSimulation = [];

    this.resizeAndRender();
  }
}

