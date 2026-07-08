import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { S3Service } from './s3.service';
import { PhotoService, Photo } from './photo.service';
import { environment } from '../../environments/environment.development';

const PHOTO_PATTERN = /cat_(\d{8})_(\d{6})\.jpg$/;

@Injectable({
  providedIn: 'root'
})
export class FavouritesService {
  public favouriteKeys$ = new BehaviorSubject<Set<string>>(new Set());
  private favouritesFolder: string;
  private bucketFolder: string;

  constructor(
    private s3Service: S3Service,
    private photoService: PhotoService
  ) {
    this.favouritesFolder = environment.aws.favouritesFolder;
    this.bucketFolder = environment.aws.bucketFolder;
  }

  /**
   * Load the current set of favourited photo filenames from the favourites S3 folder
   * Call once per session to populate the initial state
   */
  async loadFavouriteKeys(): Promise<void> {
    const keys = new Set<string>();
    let continuationToken: string | undefined;

    try {
      do {
        const response = await this.s3Service.listObjects(
          undefined,
          1000,
          continuationToken,
          this.favouritesFolder
        );

        // Filter by photo pattern and collect bare filenames
        for (const obj of response.Contents ?? []) {
          const key = obj.Key ?? '';
          const fileName = key.split('/').pop() ?? '';

          if (PHOTO_PATTERN.test(fileName)) {
            keys.add(fileName);
          }
        }

        // Continue if there are more results
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      this.favouriteKeys$.next(keys);
    } catch (error) {
      console.error('Failed to load favourite keys:', error);
    }
  }

  /**
   * Check if a photo is favourited by its filename
   */
  isFavourite(fileName: string): boolean {
    return this.favouriteKeys$.getValue().has(fileName);
  }

  /**
   * Copy a photo and its metadata to the favourites folder via presigned upload URLs
   * Updates local state on success, logs error and leaves state unchanged on failure
   */
  async addFavourite(photo: Photo, metadataKey: string): Promise<void> {
    try {
      const destJpgKey = `${this.favouritesFolder}/${photo.fileName}`;
      const destJsonKey = `${this.favouritesFolder}/${photo.fileName.replace('.jpg', '.json')}`;

      // 1. Copy the jpg using the already-fetched presigned GET URL
      const imageResponse = await fetch(photo.url);
      const imageBlob = await imageResponse.blob();
      const uploadJpgUrl = await this.s3Service.getPresignedUploadUrl(destJpgKey, 'image/jpeg');
      await fetch(uploadJpgUrl, {
        method: 'PUT',
        body: imageBlob,
        headers: { 'Content-Type': 'image/jpeg' }
      });

      // 2. Copy the metadata json
      const metadataResponse = await this.s3Service.getObject(metadataKey);
      const metadataText = await metadataResponse.Body?.transformToString();
      const uploadJsonUrl = await this.s3Service.getPresignedUploadUrl(destJsonKey, 'application/json');
      await fetch(uploadJsonUrl, {
        method: 'PUT',
        body: metadataText,
        headers: { 'Content-Type': 'application/json' }
      });

      // 3. Update local state only after both succeed (optimistic-after-success)
      const updated = new Set(this.favouriteKeys$.getValue());
      updated.add(photo.fileName);
      this.favouriteKeys$.next(updated);
    } catch (error) {
      console.error('Failed to add favourite photo:', photo.fileName, error);
    }
  }

  /**
   * Remove a photo from the favourites folder, but only if a copy still exists
   * in the working S3 folder — this keeps the removal safe/reversible (the
   * photo can be favourited again). If the working copy is already gone,
   * logs and does nothing.
   */
  async removeFavourite(photo: Photo): Promise<void> {
    try {
      const workingKey = `${this.bucketFolder}/${photo.fileName}`;
      const stillInWorkingFolder = await this.s3Service.objectExists(workingKey);

      if (!stillInWorkingFolder) {
        console.error('Cannot unfavourite: working copy no longer exists for', photo.fileName);
        return;
      }

      const destJpgKey = `${this.favouritesFolder}/${photo.fileName}`;
      const destJsonKey = `${this.favouritesFolder}/${photo.fileName.replace('.jpg', '.json')}`;

      await this.s3Service.deleteObject(destJpgKey);
      await this.s3Service.deleteObject(destJsonKey);

      const updated = new Set(this.favouriteKeys$.getValue());
      updated.delete(photo.fileName);
      this.favouriteKeys$.next(updated);
    } catch (error) {
      console.error('Failed to remove favourite photo:', photo.fileName, error);
    }
  }

  /**
   * Fetch all favourited photos as Photo objects (for browse-favourites view)
   * Returns a flat, paginated listing sorted newest-first
   */
  async getFavouritePhotos(): Promise<Photo[]> {
    const photos: Photo[] = [];
    let continuationToken: string | undefined;

    try {
      do {
        const response = await this.s3Service.listObjects(
          undefined,
          1000,
          continuationToken,
          this.favouritesFolder
        );

        // Filter by photo pattern and build Photo objects
        const filteredObjects = (response.Contents ?? []).filter(obj => {
          const fileName = (obj.Key ?? '').split('/').pop() ?? '';
          return PHOTO_PATTERN.test(fileName);
        });

        // Generate presigned URLs and photo objects in parallel
        const batch: Photo[] = await Promise.all(
          filteredObjects.map(async obj => {
            const key = obj.Key!;
            const fileName = key.split('/').pop()!;
            const timestamp = this.photoService.parseFileName(fileName)!;
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

        photos.push(...batch);

        // Continue if there are more results
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      // Sort by timestamp (newest first)
      photos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return photos;
    } catch (error) {
      console.error('Failed to get favourite photos:', error);
      return [];
    }
  }
}
