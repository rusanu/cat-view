import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhotoService, Photo } from '../../services/photo.service';
import { PhotoListComponent } from '../../components/photo-list/photo-list.component';
import { PhotoViewerComponent } from '../../components/photo-viewer/photo-viewer.component';

@Component({
  selector: 'app-photos',
  standalone: true,
  imports: [CommonModule, PhotoListComponent, PhotoViewerComponent],
  templateUrl: './photos.component.html',
  styleUrl: './photos.component.css'
})
export class PhotosComponent implements OnInit {
  photos: Photo[] = [];
  selectedPhoto: Photo | null = null;
  loading = true;
  error: string | null = null;
  startDate?: Date;
  endDate?: Date;

  constructor(private photoService: PhotoService) {}

  async ngOnInit() {
    await this.loadPhotos();
  }

  async loadPhotos() {
    try {
      this.loading = true;
      this.error = null;
      this.photos = await this.photoService.getPhotos(this.startDate, this.endDate);

      // Auto-select first photo if available
      if (this.photos.length > 0 && !this.selectedPhoto) {
        this.selectedPhoto = this.photos[0];
      }
    } catch (err: any) {
      this.error = err.message || 'Failed to load photos';
      console.error('Error loading photos:', err);
    } finally {
      this.loading = false;
    }
  }

  onPhotoSelected(photo: Photo) {
    this.selectedPhoto = photo;
  }

  async onDateRangeChanged(startDate: Date, endDate: Date) {
    this.startDate = startDate;
    this.endDate = endDate;
    await this.loadPhotos();
  }
}
