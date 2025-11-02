import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Photo } from '../../services/photo.service';
import { ActionConfigService } from '../../services/action-config.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-photo-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-list.component.html',
  styleUrl: './photo-list.component.css'
})
export class PhotoListComponent {
  @Input() photos: Photo[] = [];
  @Input() selectedPhoto: Photo | null = null;
  @Output() photoSelected = new EventEmitter<Photo>();

  private destroy$ = new Subject<void>();
  private rotation: number = 0;

  constructor(public config:ActionConfigService) {
    config.rotation$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(rotation => {
      this.rotation = rotation
    });
  }

  getRotationStyle(): string {
    return `rotate(${this.rotation}deg)`;
  }

  getBrightnessFilter(level: number | null): string {
    // Level 1 = normal (1.0), Level 5 = very bright (3.0)
    const safeLevel = level ?? 3; // Default to 3 if null
    const brightness = 1.0 + (safeLevel - 1) * 0.5;
    return `brightness(${brightness})`;
  }

  onPhotoClick(photo: Photo) {
    this.photoSelected.emit(photo);
  }

  isSelected(photo: Photo): boolean {
    return this.selectedPhoto?.key === photo.key;
  }

  trackByKey(index: number, photo: Photo): string {
    return photo.key;
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    console.error('Failed to load image:', img.src);
    // Set a placeholder or show error
    img.style.backgroundColor = '#f8f9fa';
    img.alt = 'Failed to load';
  }
}
