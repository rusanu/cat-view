import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PhotoService, Photo, PhotoPage } from '../../services/photo.service';
import { PhotoListComponent } from '../../components/photo-list/photo-list.component';
import { PhotoViewerComponent } from '../../components/photo-viewer/photo-viewer.component';
import { PhotoGraphsComponent } from '../../components/photo-graphs/photo-graphs.component';
import { DateRangeSelectorComponent, DateRange } from '../../components/date-range-selector/date-range-selector.component';
import { ActionBarComponent } from '../../components/action-bar/action-bar.component';
import { ActionConfigService } from '../../services/action-config.service';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-photos',
  standalone: true,
  imports: [CommonModule, PhotoListComponent, PhotoViewerComponent, PhotoGraphsComponent, DateRangeSelectorComponent, ActionBarComponent],
  templateUrl: './photos.component.html',
  styleUrl: './photos.component.css'
})
export class PhotosComponent implements OnInit, OnDestroy {
  photos: Photo[] = [];
  selectedPhoto: Photo | null = null;
  loading = true;
  refreshing = false; // Separate flag for incremental refresh
  error: string | null = null;
  isAuthError = false; // Flag to distinguish auth errors from other errors
  startDate?: Date;
  endDate?: Date;
  showGraphs = false; // Toggle for showing graphs
  autoRefresh = false; // Toggle for auto-refresh
  private refreshInterval: any = null;
  private readonly REFRESH_INTERVAL_MS = 60000; // 1 minute
  private currentPage = 0; // Current page index for infinite scroll
  private hasMorePhotos = true; // Flag to track if more photos available
  private readonly PAGE_SIZE = 30; // Number of photos to load per page

  // Left/Right panel resizing
  leftPanelWidth = 350; // Default width
  private isDragging = false;
  private readonly MIN_PANEL_WIDTH = 200;
  private readonly MAX_PANEL_WIDTH = 800;
  private readonly PANEL_WIDTH_KEY = 'photo-panel-width';

  // Photo/Graph vertical split resizing
  photoSectionHeight = 60; // Default percentage (60% photo, 40% graph)
  private isDraggingVertical = false;
  private readonly MIN_PHOTO_HEIGHT = 30;
  private readonly MAX_PHOTO_HEIGHT = 80;
  private readonly PHOTO_HEIGHT_KEY = 'photo-section-height';

  private destroy$ = new Subject<void>();

  private loadMoreSubject = new BehaviorSubject<boolean>(false);
  public loadMore$ = this.loadMoreSubject.asObservable();

  constructor(
    private photoService: PhotoService,
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
    await this.loadPhotos();
    // Add global mouse event listeners
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousemove', this.onVerticalMouseMove);
    document.addEventListener('mouseup', this.onVerticalMouseUp);

    this.config.autoRefresh$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(this.setAutoRefresh.bind(this));
  }

  ngOnDestroy() {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onVerticalMouseMove);
    document.removeEventListener('mouseup', this.onVerticalMouseUp);

    // Clean up auto-refresh interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadPhotos() {
    try {
      this.loading = true;
      this.error = null;
      this.photos = [];
      this.currentPage = 0;
      this.hasMorePhotos = true;

      // Clear cache when reloading (e.g., after date range change or refresh)
      this.photoService.clearCache();

      // Load first page
      const page = await this.photoService.getPhotosPage(this.PAGE_SIZE, this.currentPage);

      this.photos = page.photos;
      this.hasMorePhotos = page.hasMore;

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

  async loadMorePhotos() {
    // Prevent multiple concurrent loads or loading when there are no more photos
    if (this.loadMoreSubject.getValue() || !this.hasMorePhotos) {
      return;
    }

    try {
      this.loadMoreSubject.next(true);

      // Load next page
      this.currentPage++;
      const page = await this.photoService.getPhotosPage(this.PAGE_SIZE, this.currentPage);

      // Append new photos to existing list
      this.photos = [...this.photos, ...page.photos];
      this.hasMorePhotos = page.hasMore;

      console.log(`Loaded ${page.photos.length} more photos. Total: ${this.photos.length}`);
    } catch (err: any) {
      console.error('Error loading more photos:', err);
      // Don't show error to user for pagination failures
    } finally {
      this.loadMoreSubject.next(false);
    }
  }

  onPhotoSelected(photo: Photo) {
    this.selectedPhoto = photo;
  }

  async onDateRangeChanged(dateRange: DateRange) {
    this.startDate = dateRange.startDate;
    this.endDate = dateRange.endDate;
    // Note: Date range is kept for potential future filtering, but not used in infinite scroll
    // Clear cache and reload when date range changes
    await this.loadPhotos();
  }

  toggleGraphs() {
    this.showGraphs = !this.showGraphs;
  }

  async refreshPhotos() {
    // If we have photos already, only fetch new ones
    if (this.photos.length > 0) {
      try {
        this.refreshing = true;
        this.error = null;
        this.isAuthError = false;

        // Get the latest photo timestamp
        const latestTimestamp = this.photos[0].timestamp; // Photos are sorted newest first

        // Fetch only new photos
        const newPhotos = await this.photoService.getNewPhotosSince(latestTimestamp);

        if (newPhotos.length > 0) {
          // Prepend new photos to the list
          this.photos = [...newPhotos, ...this.photos];

          // If no photo is selected yet, select the first (newest) one
          if (!this.selectedPhoto) {
            this.selectedPhoto = this.photos[0];
          }

          console.log(`Refresh: Added ${newPhotos.length} new photo(s)`);
        } else {
          console.log('Refresh: No new photos found');
        }
      } catch (err: any) {
        this.error = err.message || 'Failed to refresh photos';
        console.error('Error refreshing photos:', err);
      } finally {
        this.refreshing = false;
      }
    } else {
      // No photos yet, do a full load
      await this.loadPhotos();
    }
  }

  setAutoRefresh(autoRefresh:boolean) {
    this.autoRefresh = autoRefresh;

    if (this.autoRefresh) {
      // Start polling
      this.refreshInterval = setInterval(() => {
        this.refreshPhotos();
      }, this.REFRESH_INTERVAL_MS);
    } else {
      // Stop polling
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    }
  }

  previousPhoto() {
    if (this.photos && this.photos.length) {
      const index = this.photos.findIndex(p => p.key === this.selectedPhoto?.key);
      if (index > 0) {
        this.selectedPhoto = this.photos[index-1];
      }
    }
  }

  nextPhoto() {
    if (this.photos && this.photos.length) {
      const index = this.photos.findIndex(p => p.key === this.selectedPhoto?.key);
      if (index >= 0 && index < this.photos.length) {
        this.selectedPhoto = this.photos[index+1];
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

  dismissError()  {
    this.error = null;
  }
}
