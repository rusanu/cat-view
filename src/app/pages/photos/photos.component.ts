import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhotoService, Photo } from '../../services/photo.service';
import { PhotoListComponent } from '../../components/photo-list/photo-list.component';
import { PhotoViewerComponent } from '../../components/photo-viewer/photo-viewer.component';
import { PhotoGraphsComponent } from '../../components/photo-graphs/photo-graphs.component';

@Component({
  selector: 'app-photos',
  standalone: true,
  imports: [CommonModule, PhotoListComponent, PhotoViewerComponent, PhotoGraphsComponent],
  templateUrl: './photos.component.html',
  styleUrl: './photos.component.css'
})
export class PhotosComponent implements OnInit, OnDestroy {
  photos: Photo[] = [];
  selectedPhoto: Photo | null = null;
  loading = true;
  error: string | null = null;
  startDate?: Date;
  endDate?: Date;
  showGraphs = false; // Toggle for showing graphs

  // Panel resizing
  leftPanelWidth = 350; // Default width
  private isDragging = false;
  private readonly MIN_PANEL_WIDTH = 200;
  private readonly MAX_PANEL_WIDTH = 800;
  private readonly PANEL_WIDTH_KEY = 'photo-panel-width';

  constructor(private photoService: PhotoService) {
    // Load saved panel width from localStorage
    const savedWidth = localStorage.getItem(this.PANEL_WIDTH_KEY);
    if (savedWidth) {
      this.leftPanelWidth = parseInt(savedWidth, 10);
    }
  }

  async ngOnInit() {
    await this.loadPhotos();
    // Add global mouse event listeners
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  ngOnDestroy() {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
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

  toggleGraphs() {
    this.showGraphs = !this.showGraphs;
  }

  // Panel resizing methods
  onDividerMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.isDragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  private onMouseMove = (event: MouseEvent) => {
    if (!this.isDragging) return;

    // Calculate new width based on mouse position
    const newWidth = event.clientX;

    // Clamp between min and max
    if (newWidth >= this.MIN_PANEL_WIDTH && newWidth <= this.MAX_PANEL_WIDTH) {
      this.leftPanelWidth = newWidth;
    }
  };

  private onMouseUp = () => {
    if (this.isDragging) {
      this.isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Save to localStorage
      localStorage.setItem(this.PANEL_WIDTH_KEY, this.leftPanelWidth.toString());
    }
  };
}
