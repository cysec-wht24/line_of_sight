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
  @Input() movingPoints: { x: number; y: number; id: number }[] = [];
  
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

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes['confirmedPoints'] && this.canvasRef) ||
      (changes['paths'] && this.canvasRef) ||
      (changes['movingPoints'] && this.canvasRef) ||
      (changes['initialPoints'] && this.canvasRef)
    ) {
      this.resizeAndRender();
    }
  }

  ngAfterViewInit(): void {     
    this.loadDEM().then(() => {       
      this.observeResizeAndRender();     
    });   
  }

  observeResizeAndRender(): void {
  const canvasParent = this.canvasRef.nativeElement.parentElement;

  if (!canvasParent) return;

  this.resizeObserver = new ResizeObserver(() => {
    this.resizeAndRender();
  });

  this.resizeObserver.observe(canvasParent);
  }

  ngOnDestroy(): void {
  if (this.resizeObserver) {
    this.resizeObserver.disconnect();
  }
  }

  @HostListener('window:resize')
  onResize() {
    this.resizeAndRender();
  }

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

  // 🆕 Mouse move handler
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

  private async loadDEM() {
    const response = await fetch('assets/n25_e077_1arc_v3.dt2');
    const arrayBuffer = await response.arrayBuffer();
    console.log('[DTED] Fetched array buffer of size:', arrayBuffer.byteLength);

    const dataView = new DataView(arrayBuffer);

    const HEADER_SIZE = 3428; // DTED2 file header size
    const LAT_POINTS = 3601;  // Number of rows
    const LON_POINTS = 3601;  // Number of columns
    const COLUMN_SIZE = 8 + LAT_POINTS * 2 + 4; // Header + data + checksum = 8 + 7202 + 4 = 7214 bytes per column

    // Sanity check
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
      const columnStart = offset + col * COLUMN_SIZE + 8; // Skip 8-byte header
      for (let row = 0; row < LAT_POINTS; row++) {
        const index = row * LON_POINTS + col;
        const valOffset = columnStart + row * 2;
        const elevation = dataView.getInt16(valOffset, false); // big-endian
        elevationData[index] = elevation;
      }
      if (col % 600 === 0) console.log(`[DTED] Processed column ${col}/${LON_POINTS}`);
    }

    this.width = LON_POINTS;
    this.height = LAT_POINTS;
    this.rasterData = elevationData;

    // Use filename to infer base coordinate
    this.tiepointX = 77;  // Longitude
    console.log('[DTED] Tiepoint X:', this.tiepointX);
    this.tiepointY = 26;  // Latitude (approx)
    console.log('[DTED] Tiepoint Y:', this.tiepointY);
    this.pixelSizeX = 1 / 3600;
    console.log('[DTED] Pixel size X:', this.pixelSizeX);
    this.pixelSizeY = 1 / 3600;
    console.log('[DTED] Pixel size Y:', this.pixelSizeY);

    // Find elevation range
    this.minElevation = Infinity;
    this.maxElevation = -Infinity;
    for (let i = 0; i < elevationData.length; i++) {
      const val = elevationData[i];
      if (val < this.minElevation) this.minElevation = val;
      if (val > this.maxElevation) this.maxElevation = val;
    }

    console.log('[DTED] Elevation range:', this.minElevation, 'to', this.maxElevation);
    console.log('[DTED] Resolution:', this.pixelSizeX, '° per pixel');

    // Save to service
    this.demDataService.rasterData = Array.from(this.rasterData);
    this.demDataService.width = this.width;
    this.demDataService.height = this.height;
    this.demDataService.tiepointX = this.tiepointX;
    this.demDataService.tiepointY = this.tiepointY;
    this.demDataService.pixelSizeX = this.pixelSizeX;
    this.demDataService.pixelSizeY = this.pixelSizeY;

    console.log('[DTED] DTED2 parsed successfully ✅');
  }

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
  }

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
}

