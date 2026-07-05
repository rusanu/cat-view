import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Photo, PhotoService } from '../../services/photo.service';
import { MetadataService, PhotoMetadata } from '../../services/metadata.service';
import { ActionConfigService } from '../../services/action-config.service';
import { FavouritesService } from '../../services/favourites.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-photo-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-viewer.component.html',
  styleUrl: './photo-viewer.component.css'
})
export class PhotoViewerComponent implements OnChanges, OnDestroy {
  @Input() photo: Photo | null = null;
  @Output() prevPhoto = new EventEmitter<void>();
  @Output() nextPhoto = new EventEmitter<void>();
  rotation: number = 0; // Rotation in degrees (0, 90, 180, 270, -90, -180, -270)
  metadata: PhotoMetadata | null = null;
  metadataLoading = false;
  private favouriteFileNames: Set<string> = new Set();
  public favouritingInProgress = new Set<string>();

  // Zoom and pan state
  scale: number = 1;
  minScale: number = 0.5;
  maxScale: number = 5;
  translateX: number = 0;
  translateY: number = 0;

  private destroy$ = new Subject<void>();
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private readonly swipeThreshold = 50; // Minimum pixels to trigger swipe

  // Zoom gesture tracking
  private lastTouchDistance: number = 0;
  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private lastTapTime: number = 0;
  private readonly doubleTapThreshold = 300; // ms
  private readonly zoomStep: number = 2.5; // Double-tap zoom level

  constructor(
    private metadataService: MetadataService,
    public config: ActionConfigService,
    public favouritesService: FavouritesService,
    private photoService: PhotoService
  ) {
    config.rotation$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(rotation => this.rotation = rotation);

    // Subscribe to favourites changes
    favouritesService.favouriteKeys$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(keys => {
      this.favouriteFileNames = keys;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  emitNextPhoto() {
    this.nextPhoto.emit();
  }

  emitPrevPhoto() {
    this.prevPhoto.emit();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['photo'] && this.photo) {
      // Reset zoom when photo changes
      this.resetZoom();
      await this.loadMetadata();
    }
  }

  async loadMetadata() {
    if (!this.photo || this.photo.key === 'live-photo') {
      this.metadata = null;
      return;
    }

    try {
      this.metadataLoading = true;
      this.metadata = await this.metadataService.getMetadata(this.photo.key);
    } catch (error) {
      console.error('Error loading metadata:', error);
      this.metadata = null;
    } finally {
      this.metadataLoading = false;
    }
  }

  getTransformStyle(): string {
    // Order matters: rotate -> scale -> translate
    // 1. Rotate first (user's orientation preference)
    // 2. Scale (zoom level)
    // 3. Translate last (pan position in screen space)
    return `rotate(${this.rotation}deg) scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`;
  }

  getBrightnessFilter(level: number | null): string {
    // Level 1 = normal (1.0), Level 5 = very bright (3.0)
    // Linear scale: 1->1.0, 2->1.5, 3->2.0, 4->2.5, 5->3.0
    const safeLevel = level ?? 3; // Default to 3 if null
    const brightness = 1.0 + (safeLevel - 1) * 0.5;
    return `brightness(${brightness})`;
  }

  formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      // Single finger touch
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;

      if (this.scale > 1) {
        // Start panning when zoomed
        this.isPanning = true;
        this.panStartX = this.translateX;
        this.panStartY = this.translateY;
      }
    } else if (event.touches.length === 2) {
      // Two finger touch - prepare for pinch zoom
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      this.lastTouchDistance = this.getTouchDistance(touch1, touch2);
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (event.touches.length === 1 && this.isPanning && this.scale > 1) {
      // Single finger pan when zoomed
      event.preventDefault();
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;

      // Rotate deltas to account for image rotation
      const rotated = this.rotatePanDelta(deltaX, deltaY);

      this.translateX = this.panStartX + rotated.x / this.scale;
      this.translateY = this.panStartY + rotated.y / this.scale;
      this.clampTranslation();
    } else if (event.touches.length === 2) {
      // Two finger pinch zoom
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const currentDistance = this.getTouchDistance(touch1, touch2);

      if (this.lastTouchDistance > 0) {
        const scaleChange = currentDistance / this.lastTouchDistance;
        this.scale = Math.min(Math.max(this.scale * scaleChange, this.minScale), this.maxScale);

        // Reset translation if zoomed back to min
        if (this.scale === this.minScale) {
          this.translateX = 0;
          this.translateY = 0;
        } else {
          this.clampTranslation();
        }
      }

      this.lastTouchDistance = currentDistance;
    }
  }

  onTouchEnd(event: TouchEvent): void {
    if (event.touches.length === 0) {
      // All fingers lifted
      if (this.isPanning) {
        // End panning
        this.isPanning = false;
      } else if (this.scale === 1) {
        // Check for swipe navigation (only when not zoomed)
        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;
        const deltaX = touchEndX - this.touchStartX;
        const deltaY = touchEndY - this.touchStartY;

        // Check for double-tap
        const now = Date.now();
        if (now - this.lastTapTime < this.doubleTapThreshold && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
          this.toggleZoom();
          this.lastTapTime = 0; // Reset to prevent triple-tap
          return;
        }
        this.lastTapTime = now;

        // Only trigger swipe if horizontal movement is greater than vertical
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.swipeThreshold) {
          if (deltaX > 0) {
            this.emitPrevPhoto();
          } else {
            this.emitNextPhoto();
          }
        }
      }

      this.lastTouchDistance = 0;
    }
  }

  getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Rotate pan deltas to account for image rotation
  // When image is rotated, screen pan gestures need to be transformed to image space
  rotatePanDelta(deltaX: number, deltaY: number): { x: number, y: number } {
    const radians = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    // Apply inverse rotation to deltas
    return {
      x: deltaX * cos + deltaY * sin,
      y: -deltaX * sin + deltaY * cos
    };
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.scale = Math.min(Math.max(this.scale * zoomFactor, this.minScale), this.maxScale);

    if (this.scale === this.minScale) {
      this.translateX = 0;
      this.translateY = 0;
    } else {
      this.clampTranslation();
    }
  }

  onMouseDown(event: MouseEvent): void {
    if (this.scale > 1) {
      this.isPanning = true;
      this.touchStartX = event.clientX;
      this.touchStartY = event.clientY;
      this.panStartX = this.translateX;
      this.panStartY = this.translateY;
      event.preventDefault();
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (this.isPanning && this.scale > 1) {
      const deltaX = event.clientX - this.touchStartX;
      const deltaY = event.clientY - this.touchStartY;

      // Rotate deltas to account for image rotation
      const rotated = this.rotatePanDelta(deltaX, deltaY);

      this.translateX = this.panStartX + rotated.x / this.scale;
      this.translateY = this.panStartY + rotated.y / this.scale;
      this.clampTranslation();
      event.preventDefault();
    }
  }

  onMouseUp(): void {
    this.isPanning = false;
  }

  onDoubleClick(): void {
    this.toggleZoom();
  }

  toggleZoom(): void {
    if (this.scale === 1) {
      this.scale = this.zoomStep;
    } else {
      this.resetZoom();
    }
  }

  resetZoom(): void {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
  }

  clampTranslation(): void {
    // Limit panning to prevent image from going too far off-screen
    // Allow some overflow but not complete disappearance
    const maxTranslate = 100; // pixels
    this.translateX = Math.min(Math.max(this.translateX, -maxTranslate), maxTranslate);
    this.translateY = Math.min(Math.max(this.translateY, -maxTranslate), maxTranslate);
  }

  isFavourite(): boolean {
    return this.photo ? this.favouritesService.isFavourite(this.photo.fileName) : false;
  }

  isFavouring(): boolean {
    return this.photo ? this.favouritingInProgress.has(this.photo.fileName) : false;
  }

  async onFavouriteClick(): Promise<void> {
    if (!this.photo || this.isFavourite() || this.isFavouring()) return;

    this.favouritingInProgress.add(this.photo.fileName);
    try {
      const metadataKey = this.photoService.getMetadataKey(this.photo.key);
      await this.favouritesService.addFavourite(this.photo, metadataKey);
    } catch (error) {
      console.error('Failed to favourite photo:', this.photo.fileName, error);
    } finally {
      this.favouritingInProgress.delete(this.photo.fileName);
    }
  }
}
