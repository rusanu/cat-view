import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Photo, PhotoService } from '../../services/photo.service';
import { ActionConfigService } from '../../services/action-config.service';
import { FavouritesService } from '../../services/favourites.service';
import { Subject, takeUntil, fromEvent, debounceTime, Observable } from 'rxjs';

@Component({
  selector: 'app-photo-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-list.component.html',
  styleUrl: './photo-list.component.css'
})
export class PhotoListComponent implements OnInit, OnDestroy {
  @Input() photos: Photo[] = [];
  @Input() selectedPhoto: Photo | null = null;
  @Input() loadMore$: Observable<boolean> | null = null;
  @Input() isLiveActive = false;
  @Input() livePhotoUrl: string | null = null;
  @Input() isLiveConnecting = false;
  @Output() photoSelected = new EventEmitter<Photo>();
  @Output() livePhotoClicked = new EventEmitter<void>();
  @Output() loadMore = new EventEmitter<void>();
  @ViewChild('scrollContainer', { static: false }) scrollContainer?: ElementRef;

  private destroy$ = new Subject<void>();
  private rotation: number = 0;
  private favouriteFileNames: Set<string> = new Set();
  public favoritingInProgress = new Set<string>();

  public isLoadingMore = false;

  constructor(
    public config: ActionConfigService,
    public favouritesService: FavouritesService,
    private photoService: PhotoService
  ) {
    config.rotation$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(rotation => {
      this.rotation = rotation
    });

    // Subscribe to favourites changes
    favouritesService.favouriteKeys$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(keys => {
      this.favouriteFileNames = keys;
    });
  }

  ngOnInit() {
    // Set up scroll listener with debounce
    setTimeout(() => {
      if (this.scrollContainer) {
        fromEvent(this.scrollContainer.nativeElement, 'scroll')
          .pipe(
            debounceTime(200),
            takeUntil(this.destroy$)
          )
          .subscribe(() => this.onScroll());
      }
    });
    this.loadMore$?.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      this.isLoadingMore = value;}
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private onScroll() {
    if (!this.scrollContainer) return;

    // Don't trigger load more if already loading
    if (this.isLoadingMore) return;

    const element = this.scrollContainer.nativeElement;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    // Load more when user is within 500px of bottom
    if (scrollHeight - scrollPosition < 500) {
      this.loadMore.emit();
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

  onLiveCardClick() {
    this.livePhotoClicked.emit();
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
    return this.favouritesService.isFavourite(photo.fileName);
  }

  isFavouring(photo: Photo): boolean {
    return this.favoritingInProgress.has(photo.fileName);
  }

  async onFavouriteClick(event: Event, photo: Photo) {
    event.stopPropagation();

    // No-op if already favourited or in-flight
    if (this.isFavourite(photo) || this.isFavouring(photo)) return;

    this.favoritingInProgress.add(photo.fileName);
    try {
      const metadataKey = this.photoService.getMetadataKey(photo.key);
      await this.favouritesService.addFavourite(photo, metadataKey);
    } catch (error) {
      console.error('Failed to favourite photo:', photo.fileName, error);
    } finally {
      this.favoritingInProgress.delete(photo.fileName);
    }
  }
}
