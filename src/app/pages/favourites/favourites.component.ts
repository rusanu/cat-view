import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FavouritesService } from '../../services/favourites.service';
import { Photo } from '../../services/photo.service';
import { PhotoListComponent } from '../../components/photo-list/photo-list.component';
import { PhotoViewerComponent } from '../../components/photo-viewer/photo-viewer.component';
import { PhotoGraphsComponent } from '../../components/photo-graphs/photo-graphs.component';
import { ActionBarComponent } from '../../components/action-bar/action-bar.component';
import { ActionConfigService } from '../../services/action-config.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-favourites',
  standalone: true,
  imports: [CommonModule, PhotoListComponent, PhotoViewerComponent, PhotoGraphsComponent, ActionBarComponent],
  templateUrl: './favourites.component.html',
  styleUrl: './favourites.component.css'
})
export class FavouritesComponent implements OnInit, OnDestroy {
  photos: Photo[] = [];
  selectedPhoto: Photo | null = null;
  loading = true;
  refreshing = false;
  error: string | null = null;
  showGraphs = false; // Toggle for showing graphs

  // Left/Right panel resizing
  leftPanelWidth = 350; // Default width
  private isDragging = false;
  private readonly MIN_PANEL_WIDTH = 200;
  private readonly MAX_PANEL_WIDTH = 800;
  private readonly PANEL_WIDTH_KEY = 'favourites-panel-width';

  // Photo/Graph vertical split resizing
  photoSectionHeight = 60; // Default percentage (60% photo, 40% graph)
  private isDraggingVertical = false;
  private readonly MIN_PHOTO_HEIGHT = 30;
  private readonly MAX_PHOTO_HEIGHT = 80;
  private readonly PHOTO_HEIGHT_KEY = 'favourites-photo-section-height';

  private destroy$ = new Subject<void>();

  constructor(
    private favouritesService: FavouritesService,
    public config: ActionConfigService,
    private router: Router
  ) {
    // Load saved panel width from localStorage
    const savedWidth = localStorage.getItem(this.PANEL_WIDTH_KEY);
    if (savedWidth) {
      this.leftPanelWidth = parseInt(savedWidth, 10);
    }

    // Load saved photo section height from localStorage
    const savedHeight = localStorage.getItem(this.PHOTO_HEIGHT_KEY);
    if (savedHeight) {
      this.photoSectionHeight = parseInt(savedHeight, 10);
    }
  }

  async ngOnInit() {
    await this.loadFavourites();
    // Add global mouse event listeners
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousemove', this.onVerticalMouseMove);
    document.addEventListener('mouseup', this.onVerticalMouseUp);
  }

  ngOnDestroy() {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onVerticalMouseMove);
    document.removeEventListener('mouseup', this.onVerticalMouseUp);

    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadFavourites() {
    try {
      this.loading = true;
      this.error = null;
      this.photos = await this.favouritesService.getFavourites();

      // Auto-select first photo if available
      if (this.photos.length > 0 && !this.selectedPhoto) {
        this.selectedPhoto = this.photos[0];
      }
    } catch (err: any) {
      this.error = err.message || 'Eroare la încărcarea pozelor favorite';
      console.error('Error loading favourites:', err);
    } finally {
      this.loading = false;
    }
  }

  onPhotoSelected(photo: Photo) {
    this.selectedPhoto = photo;
  }

  toggleGraphs() {
    this.showGraphs = !this.showGraphs;
  }

  async refreshFavourites() {
    try {
      this.refreshing = true;
      this.error = null;

      // Clear cache and reload
      this.favouritesService.clearCache();
      await this.loadFavourites();

      console.log('Favourites refreshed');
    } catch (err: any) {
      this.error = err.message || 'Eroare la reîmprospătarea pozelor favorite';
      console.error('Error refreshing favourites:', err);
    } finally {
      this.refreshing = false;
    }
  }

  previousPhoto() {
    if (this.photos && this.photos.length) {
      const index = this.photos.findIndex(p => p.key === this.selectedPhoto?.key);
      if (index > 0) {
        this.selectedPhoto = this.photos[index - 1];
      }
    }
  }

  nextPhoto() {
    if (this.photos && this.photos.length) {
      const index = this.photos.findIndex(p => p.key === this.selectedPhoto?.key);
      if (index >= 0 && index < this.photos.length) {
        this.selectedPhoto = this.photos[index + 1];
      }
    }
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

  // Vertical divider (photo/graph split) methods
  onVerticalDividerMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.isDraggingVertical = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }

  private onVerticalMouseMove = (event: MouseEvent) => {
    if (!this.isDraggingVertical) return;

    const viewerPanel = document.querySelector('.photo-viewer-panel') as HTMLElement;
    if (!viewerPanel) return;

    const rect = viewerPanel.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const newHeightPercent = (y / rect.height) * 100;

    // Clamp between min and max
    if (newHeightPercent >= this.MIN_PHOTO_HEIGHT && newHeightPercent <= this.MAX_PHOTO_HEIGHT) {
      this.photoSectionHeight = newHeightPercent;
    }
  };

  private onVerticalMouseUp = () => {
    if (this.isDraggingVertical) {
      this.isDraggingVertical = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Save to localStorage
      localStorage.setItem(this.PHOTO_HEIGHT_KEY, this.photoSectionHeight.toString());
    }
  };

  dismissError() {
    this.error = null;
  }

  navigateToPhotos() {
    this.router.navigate(['/']);
  }
}
