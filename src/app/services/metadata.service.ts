import { Injectable } from '@angular/core';
import { S3Service } from './s3.service';

export interface PhotoMetadata {
  timestamp: string;
  uptime_seconds: number;
  temperature_celsius: number;
  humidity_percent: number;
  cat_present: boolean;
  seconds_since_last_motion: number;
  blanket_on: boolean;
  blanket_manual_override?: boolean;
  mode?: string;
  dht22_sensor_working?: boolean;
  chip_temperature?: number;
  wifi_connected?: boolean;
  camera_available?: boolean;
  image_quality_metrics?: {
    brightness: number;
    contrast: number;
    qualityScore: number;
    sharpness: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class MetadataService {
  private metadataCache: Map<string, PhotoMetadata> = new Map();

  constructor(private s3Service: S3Service) { }

  /**
   * Get metadata for a photo by its S3 key
   * @param photoKey The S3 key of the photo (e.g., "folder/cat_20251030_123202.jpg")
   * @returns The metadata or null if not found/error
   */
  async getMetadata(photoKey: string): Promise<PhotoMetadata | null> {
    // Check cache first
    if (this.metadataCache.has(photoKey)) {
      return this.metadataCache.get(photoKey)!;
    }

    try {
      // Convert .jpg key to .json key
      const metadataKey = photoKey.replace('.jpg', '.json');

      // Get the object from S3
      const response = await this.s3Service.getObject(metadataKey);

      // Read the response body
      const bodyText = await response.Body?.transformToString();

      if (!bodyText) {
        console.warn('No metadata found for:', photoKey);
        return null;
      }

      // Parse JSON with better error handling
      try {
        const metadata: PhotoMetadata = JSON.parse(bodyText);

        // Cache the metadata
        this.metadataCache.set(photoKey, metadata);

        return metadata;
      } catch (jsonError: any) {
        console.error('JSON parse error for', photoKey, ':', jsonError.message);
        console.debug('Malformed JSON content:', bodyText.substring(0, 200));
        return null;
      }
    } catch (error: any) {
      console.error('Error fetching metadata for', photoKey, ':', error);
      return null;
    }
  }

  /**
   * Clear the metadata cache
   */
  clearCache() {
    this.metadataCache.clear();
  }
}
