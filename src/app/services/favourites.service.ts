import { Injectable } from '@angular/core';
import { S3Service } from './s3.service';
import { Photo } from './photo.service';

@Injectable({
  providedIn: 'root'
})
export class FavouritesService {
  // File pattern: cat_YYYYMMDD_HHMMSS.jpg
  private readonly PHOTO_PATTERN = /cat_(\d{8})_(\d{6})\.jpg$/;

  // Cache of favourite photo keys (fileName only, without folder path)
  private favouritesCache: Set<string> = new Set();
  private cacheLoaded = false;

  constructor(private s3Service: S3Service) { }

  /**
   * Get the favourites S3 key for a regular photo key
   */
  private getFavouriteKey(regularKey: string): string {
    const fileName = regularKey.split('/').pop()!;
    return `${this.s3Service.getFavouritesFolder()}/${fileName}`;
  }

  /**
   * Load all favourites into cache (for fast lookup)
   */
  private async loadFavouritesCache(): Promise<void> {
    if (this.cacheLoaded) return;

    try {
      // List all objects in favourites folder
      const response = await this.s3Service.listObjects('', 10000);
      const objects = response.Contents || [];

      // Extract just the filenames (not full keys) of .jpg files
      this.favouritesCache.clear();
      objects.forEach(obj => {
        const key = obj.Key || '';
        if (key.includes(this.s3Service.getFavouritesFolder())) {
          const fileName = key.split('/').pop() || '';
          if (this.PHOTO_PATTERN.test(fileName)) {
            this.favouritesCache.add(fileName);
          }
        }
      });

      this.cacheLoaded = true;
    } catch (error) {
      console.error('Error loading favourites cache:', error);
      // Don't throw - allow the app to continue even if favourites fail
    }
  }

  /**
   * Check if a photo is marked as favourite
   * @param photoKey The full S3 key of the photo
   */
  async isFavourite(photoKey: string): Promise<boolean> {
    await this.loadFavouritesCache();
    const fileName = photoKey.split('/').pop() || '';
    return this.favouritesCache.has(fileName);
  }

  /**
   * Add a photo to favourites
   * Copies both the .jpg and .json files to the favourites folder
   * @param photoKey The full S3 key of the photo to add
   */
  async addToFavourites(photoKey: string): Promise<void> {
    const fileName = photoKey.split('/').pop()!;

    // Check if already a favourite
    if (this.favouritesCache.has(fileName)) {
      console.log('Photo already in favourites:', fileName);
      return;
    }

    try {
      // Copy the photo file
      const favouriteKey = this.getFavouriteKey(photoKey);
      await this.s3Service.copyObject(photoKey, favouriteKey);

      // Copy the metadata JSON file
      const metadataKey = photoKey.replace('.jpg', '.json');
      const favouriteMetadataKey = favouriteKey.replace('.jpg', '.json');

      // Check if metadata exists before copying
      const metadataExists = await this.s3Service.objectExists(metadataKey);
      if (metadataExists) {
        await this.s3Service.copyObject(metadataKey, favouriteMetadataKey);
      }

      // Update cache
      this.favouritesCache.add(fileName);
      console.log('Added to favourites:', fileName);
    } catch (error) {
      console.error('Error adding to favourites:', error);
      throw error;
    }
  }

  /**
   * Remove a photo from favourites
   * Note: Currently not implemented as S3 delete requires additional permissions
   * For now, favourites can only be added, not removed
   * @param photoKey The full S3 key of the photo to remove
   */
  async removeFromFavourites(photoKey: string): Promise<void> {
    // TODO: Implement when delete permissions are available
    console.warn('Remove from favourites not yet implemented');
    throw new Error('Remove from favourites is not yet implemented');
  }

  /**
   * Toggle favourite status
   * @param photoKey The full S3 key of the photo
   */
  async toggleFavourite(photoKey: string): Promise<boolean> {
    const isFav = await this.isFavourite(photoKey);

    if (isFav) {
      // Cannot remove yet
      console.warn('Cannot remove favourites yet');
      return true; // Still a favourite
    } else {
      await this.addToFavourites(photoKey);
      return true; // Now a favourite
    }
  }

  /**
   * Parse filename to extract timestamp
   * Example: cat_20251030_032811.jpg -> Date object
   * IMPORTANT: Filenames are in UTC, so we parse as UTC
   */
  private parseFileName(fileName: string): Date | null {
    const match = fileName.match(this.PHOTO_PATTERN);
    if (!match) return null;

    const dateStr = match[1]; // YYYYMMDD
    const timeStr = match[2]; // HHMMSS

    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS months are 0-indexed
    const day = parseInt(dateStr.substring(6, 8), 10);
    const hour = parseInt(timeStr.substring(0, 2), 10);
    const minute = parseInt(timeStr.substring(2, 4), 10);
    const second = parseInt(timeStr.substring(4, 6), 10);

    // Create UTC date (filenames are in UTC)
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  /**
   * Get all favourite photos
   */
  async getFavourites(): Promise<Photo[]> {
    await this.loadFavouritesCache();

    try {
      // List all objects in favourites folder with the correct prefix
      const favouritesFolder = this.s3Service.getFavouritesFolder();

      // List objects with favourites folder as prefix
      const response = await this.s3Service.listObjects('', 10000);
      const objects = response.Contents || [];

      // Filter for photos in favourites folder
      const filteredObjects = objects.filter(obj => {
        const key = obj.Key || '';
        // Check if key is in favourites folder and matches pattern
        if (!key.includes(favouritesFolder)) return false;

        const fileName = key.split('/').pop() || '';
        return this.PHOTO_PATTERN.test(fileName);
      });

      // Generate pre-signed URLs for all photos (in parallel)
      const photos: Photo[] = await Promise.all(
        filteredObjects.map(async obj => {
          const key = obj.Key!;
          const fileName = key.split('/').pop()!;
          const timestamp = this.parseFileName(fileName)!;
          const url = await this.s3Service.getPresignedUrl(key);

          return {
            key,
            fileName,
            timestamp,
            url,
            size: obj.Size
          };
        })
      );

      // Sort by timestamp (newest first)
      photos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return photos;
    } catch (error) {
      console.error('Error getting favourites:', error);
      return [];
    }
  }

  /**
   * Clear the favourites cache (useful after logout or manual refresh)
   */
  clearCache(): void {
    this.favouritesCache.clear();
    this.cacheLoaded = false;
  }
}
