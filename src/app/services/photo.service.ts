import { Injectable } from '@angular/core';
import { S3Service } from './s3.service';

export interface Photo {
  key: string;
  fileName: string;
  timestamp: Date;
  url: string;
  size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  // File pattern: cat_YYYYMMDD_HHMMSS.jpg
  private readonly PHOTO_PATTERN = /cat_(\d{8})_(\d{6})\.jpg$/;

  constructor(private s3Service: S3Service) { }

  /**
   * Parse filename to extract timestamp
   * Example: cat_20251030_032811.jpg -> Date object
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

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Get photos from S3 filtered by date range
   * @param startDate Start of date range (default: 24 hours ago)
   * @param endDate End of date range (default: now)
   * @param maxPhotos Maximum number of photos to return (default: 1000)
   */
  async getPhotos(
    startDate?: Date,
    endDate?: Date,
    maxPhotos: number = 1000
  ): Promise<Photo[]> {
    // Default to last 24 hours
    if (!endDate) {
      endDate = new Date();
    }
    if (!startDate) {
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    }

    // List all objects with reasonable limit
    const response = await this.s3Service.listObjects('', maxPhotos);

    if (!response.Contents) {
      return [];
    }

    // Filter and map to Photo objects
    const photos: Photo[] = response.Contents
      .filter(obj => {
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
      })
      .map(obj => {
        const key = obj.Key!;
        const fileName = key.split('/').pop()!;
        const timestamp = this.parseFileName(fileName)!;

        return {
          key,
          fileName,
          timestamp,
          url: this.s3Service.getObjectUrl(key),
          size: obj.Size
        };
      });

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
   * Get the metadata JSON file key for a photo
   */
  getMetadataKey(photoKey: string): string {
    return photoKey.replace('.jpg', '.json');
  }
}
