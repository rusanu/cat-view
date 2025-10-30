import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Photo } from '../../services/photo.service';

@Component({
  selector: 'app-photo-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-viewer.component.html',
  styleUrl: './photo-viewer.component.css'
})
export class PhotoViewerComponent {
  @Input() photo: Photo | null = null;
  rotation: number = 0; // Rotation in degrees (0, 90, 180, 270, -90, -180, -270)

  rotateClockwise() {
    this.rotation = (this.rotation + 90) % 360;
  }

  rotateCounterClockwise() {
    this.rotation = (this.rotation - 90 + 360) % 360;
  }

  resetRotation() {
    this.rotation = 0;
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
}
