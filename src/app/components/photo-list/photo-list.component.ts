import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Photo } from '../../services/photo.service';
import { ActionConfigService } from '../../services/action-config.service';
import { FavouritesService } from '../../services/favourites.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-photo-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-list.component.html',
  styleUrl: './photo-list.component.css'
})
export class PhotoListComponent implements OnInit, OnDestroy, OnChanges {
  @Input() photos: Photo[] = [];
  @Input() selectedPhoto: Photo | null = null;
  @Input() showFavourites = true; // Show favourite icons by default
  @Output() photoSelected = new EventEmitter<Photo>();

  private destroy$ = new Subject<void>();
  private rotation: number = 0;
  favourites = new Map<string, boolean>(); // Map of photo key to favourite status
  togglingFavourite = new Set<string>(); // Track photos currently being toggled

  constructor(
    public config: ActionConfigService,
    private favouritesService: FavouritesService
  ) {
    config.rotation$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(rotation => {
      this.rotation = rotation
    });
  }

  async ngOnInit() {
    await this.loadFavouritesStatus();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async ngOnChanges(changes: SimpleChanges) {
    // Reload favourites when photos change
    if (changes['photos']) {
      await this.loadFavouritesStatus();
    }
  }

  private async loadFavouritesStatus() {
    if (!this.showFavourites || this.photos.length === 0) return;

    try {
      // Check favourite status for all photos in parallel
      const results = await Promise.all(
        this.photos.map(async photo => ({
          key: photo.key,
          isFavourite: await this.favouritesService.isFavourite(photo.key)
        }))
      );

      // Update favourites map
      results.forEach(result => {
        this.favourites.set(result.key, result.isFavourite);
      });
    } catch (error) {
      console.error('Error loading favourites status:', error);
    }
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

  isFavourite(photo: Photo): boolean {
    return this.favourites.get(photo.key) === true;
  }

  isTogglingFavourite(photo: Photo): boolean {
    return this.togglingFavourite.has(photo.key);
  }

  async onFavouriteClick(event: Event, photo: Photo) {
    event.stopPropagation(); // Prevent photo selection

    if (this.togglingFavourite.has(photo.key)) {
      return; // Already toggling this photo
    }

    try {
      this.togglingFavourite.add(photo.key);

      // Toggle favourite status
      const newStatus = await this.favouritesService.toggleFavourite(photo.key);

      // Update local state
      this.favourites.set(photo.key, newStatus);
    } catch (error) {
      console.error('Error toggling favourite:', error);
    } finally {
      this.togglingFavourite.delete(photo.key);
    }
  }
}
