import { Injectable } from '@angular/core';
import { S3Service } from './s3.service';

export interface Photo {
  key: string;
  fileName: string;
  timestamp: Date;
  url: string;
  size?: number;
}

export interface PhotoPage {
  photos: Photo[];
  continuationToken?: string;
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  // File pattern: cat_YYYYMMDD_HHMMSS.jpg
  private readonly PHOTO_PATTERN = /cat_(\d{8})_(\d{6})\.jpg$/;

  // Cache for paginated photos
  private photoCache: Photo[] | null = null;
  private cacheStartDate: Date | null = null;
  private cacheEndDate: Date | null = null;

  constructor(private s3Service: S3Service) { }

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
   * Generate S3 prefixes for date range
   * Returns prefixes like: ["cat_20251102_", "cat_20251101_", "cat_20251031_"]
   * Includes extra day before/after to avoid midnight cutoff issues
   * IMPORTANT: Uses UTC dates since filenames are in UTC
   */
  private getDatePrefixes(startDate: Date, endDate: Date): string[] {
    const prefixes: string[] = [];

    // Work in UTC since filenames are UTC-based
    // Add one day before and after to avoid cutoff issues
    const start = new Date(startDate);
    start.setUTCDate(start.getUTCDate() - 1);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCHours(0, 0, 0, 0);

    const current = new Date(start);

    while (current <= end) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, '0');
      const day = String(current.getUTCDate()).padStart(2, '0');
      prefixes.push(`cat_${year}${month}${day}_`);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return prefixes;
  }

  /**
   * Get photos from S3 filtered by date range
   * Fetches ALL photos in the date range using S3 continuation tokens
   * @param startDate Start of date range (default: 24 hours ago)
   * @param endDate End of date range (default: now)
   */
  async getPhotos(
    startDate?: Date,
    endDate?: Date
  ): Promise<Photo[]> {
    // Default to last 24 hours
    if (!endDate) {
      endDate = new Date();
    }
    if (!startDate) {
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    }

    // Get date-based prefixes (includes +/- 1 day to avoid midnight cutoff)
    const prefixes = this.getDatePrefixes(startDate, endDate);

    const allObjects: any[] = [];

    // Fetch ALL objects from each prefix using continuation tokens
    for (const prefix of prefixes) {
      let continuationToken: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await this.s3Service.listObjects(prefix, 1000, continuationToken);

        if (response.Contents) {
          allObjects.push(...response.Contents);
        }

        if (response.IsTruncated && response.NextContinuationToken) {
          continuationToken = response.NextContinuationToken;
        } else {
          hasMore = false;
        }
      }
    }

    // Filter objects by exact date range and pattern
    const filteredObjects = allObjects.filter(obj => {
      const key = obj.Key || '';
      const fileName = key.split('/').pop() || '';

      // Only include .jpg files matching the pattern
      if (!this.PHOTO_PATTERN.test(fileName)) {
        return false;
      }

      // Parse timestamp and filter by date range
      const timestamp = this.parseFileName(fileName);
      if (!timestamp) return false;

      return timestamp >= startDate! && timestamp <= endDate!;
    });

    console.log(`Loaded ${filteredObjects.length} photos from S3 for date range`);

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
  }

  /**
   * Get photos for the last 24 hours (default view)
   */
  async getLast24Hours(): Promise<Photo[]> {
    return this.getPhotos();
  }

  /**
   * Get only new photos since a specific timestamp
   * Used for incremental refresh
   * @param sinceTimestamp Only return photos newer than this
   * @param maxPhotos Maximum number of photos to return
   */
  async getNewPhotosSince(sinceTimestamp: Date, maxPhotos: number = 1000): Promise<Photo[]> {
    const now = new Date();

    // Get date-based prefixes (includes +/- 1 day to avoid cutoff)
    const prefixes = this.getDatePrefixes(sinceTimestamp, now);

    // List objects for each prefix in parallel
    const responses = await this.s3Service.listObjectsWithPrefixes(prefixes, 1000);

    // Combine all results from all prefixes
    const allObjects = responses.flatMap(response => response.Contents || []);

    // Filter for photos newer than sinceTimestamp
    const filteredObjects = allObjects.filter(obj => {
      const key = obj.Key || '';
      const fileName = key.split('/').pop() || '';

      // Only include .jpg files matching the pattern
      if (!this.PHOTO_PATTERN.test(fileName)) {
        return false;
      }

      // Parse timestamp and filter for newer photos
      const timestamp = this.parseFileName(fileName);
      if (!timestamp) return false;

      return timestamp > sinceTimestamp && timestamp <= now;
    });

    // Generate pre-signed URLs for new photos (in parallel)
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
  }

  /**
   * Get the metadata JSON file key for a photo
   */
  getMetadataKey(photoKey: string): string {
    return photoKey.replace('.jpg', '.json');
  }

  /**
   * Clear the photo cache (call when date range changes)
   */
  clearCache() {
    this.photoCache = null;
    this.cacheStartDate = null;
    this.cacheEndDate = null;
  }

  /**
   * Get a page of photos with pagination support
   * Strategy: S3 cannot list in reverse order, so we fetch all photos for the date range
   * once and cache them, then paginate client-side. This is efficient for 24h (~240 photos).
   * @param startDate Start of date range (default: 24 hours ago)
   * @param endDate End of date range (default: now)
   * @param pageSize Number of photos per page (default: 30)
   * @param continuationToken Client-side pagination token (stringified index)
   * @returns PhotoPage with photos and continuation info
   */
  async getPhotosPage(
    startDate?: Date,
    endDate?: Date,
    pageSize: number = 30,
    continuationToken?: string
  ): Promise<PhotoPage> {
    // Default to last 24 hours
    if (!endDate) {
      endDate = new Date();
    }
    if (!startDate) {
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    }

    // Check if cache is valid for this date range
    const cacheValid = this.photoCache &&
                       this.cacheStartDate?.getTime() === startDate.getTime() &&
                       this.cacheEndDate?.getTime() === endDate.getTime();

    // Load and cache all photos if cache is invalid
    if (!cacheValid) {
      console.log('Loading full photo list for date range (will be cached)');
      this.photoCache = await this.getPhotos(startDate, endDate);
      this.cacheStartDate = startDate;
      this.cacheEndDate = endDate;
    }

    // Parse client-side continuation token (it's just an index)
    const startIndex = continuationToken ? parseInt(continuationToken, 10) : 0;
    const endIndex = startIndex + pageSize;

    // Return page from cache
    const photos = this.photoCache!.slice(startIndex, endIndex);
    const hasMore = endIndex < this.photoCache!.length;
    const nextToken = hasMore ? endIndex.toString() : undefined;

    console.log(`Returning page: photos ${startIndex}-${endIndex-1} of ${this.photoCache!.length} total`);

    return {
      photos,
      continuationToken: nextToken,
      hasMore
    };
  }
}
