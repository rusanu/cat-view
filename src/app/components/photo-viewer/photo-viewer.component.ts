import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Photo } from '../../services/photo.service';
import { MetadataService, PhotoMetadata } from '../../services/metadata.service';
import { ActionConfigService } from '../../services/action-config.service';
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

  private destroy$ = new Subject<void>();

  constructor(private metadataService: MetadataService, public config:ActionConfigService) {
    config.rotation$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(rotation => this.rotation = rotation);
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
      await this.loadMetadata();
    }
  }

  async loadMetadata() {
    if (!this.photo) {
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

  getRotationStyle(): string {
    return `rotate(${this.rotation}deg)`;
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
}
