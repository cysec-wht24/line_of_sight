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

@Component({
  selector: 'app-dem-display',
  templateUrl: './dem-display.component.html',
  styleUrls: ['./dem-display.component.css']
})
export class DemDisplayComponent implements AfterViewInit, OnChanges {

  @ViewChild('demCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  @Input() confirmedPoints: { lat: number; lon: number; elevation: number }[] = [];
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
      (changes['movingPoints'] && this.canvasRef)
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
    const response = await fetch('assets/dem.tif');
    const arrayBuffer = await response.arrayBuffer();
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    this.width = image.getWidth();
    this.height = image.getHeight();

    this.rasterData = await image.readRasters({ interleave: true }) as Float32Array;
    //console.log(this.rasterData);

    // 🆕 Extract tiepoint and pixel scale for geo conversion
    const tiepoint = image.getTiePoints()[0];
    const fileDirectory = image.getFileDirectory();
    const pixelScale = fileDirectory.ModelPixelScale;

    this.tiepointX = tiepoint.x;
    this.tiepointY = tiepoint.y;
    this.pixelSizeX = pixelScale[0];
    this.pixelSizeY = pixelScale[1];

    this.minElevation = Infinity;
    this.maxElevation = -Infinity;
    for (let i = 0; i < this.rasterData.length; i++) {
      const val = this.rasterData[i];
      if (val === 0) continue;
      if (val < this.minElevation) this.minElevation = val;
      if (val > this.maxElevation) this.maxElevation = val;
    }

    console.log('DEM loaded:');
    console.log('  tiepointX:', this.tiepointX, 'tiepointY:', this.tiepointY);
    console.log('  pixelSizeX:', this.pixelSizeX, 'pixelSizeY:', this.pixelSizeY);
    console.log('  width:', this.width, 'height:', this.height);
    console.log('  minElevation:', this.minElevation, 'maxElevation:', this.maxElevation);
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

