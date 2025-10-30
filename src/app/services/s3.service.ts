import { Injectable } from '@angular/core';
import { S3Client, ListObjectsV2Command, GetObjectCommand, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private bucketFolder: string;
  private urlCache: Map<string, { url: string, expires: number }> = new Map();

  constructor() {
    this.bucketName = environment.aws.bucketName;
    this.bucketFolder = environment.aws.bucketFolder;

    this.s3Client = new S3Client({
      region: environment.aws.region,
      credentials: {
        accessKeyId: environment.aws.accessKeyId,
        secretAccessKey: environment.aws.secretAccessKey,
      }
    });
  }

  /**
   * List objects in the S3 bucket with optional prefix filter
   * Automatically prepends the bucket folder to the prefix
   */
  async listObjects(prefix?: string, maxKeys?: number): Promise<ListObjectsV2CommandOutput> {
    const fullPrefix = prefix ? `${this.bucketFolder}/${prefix}` : this.bucketFolder;

    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: fullPrefix,
      MaxKeys: maxKeys
    });

    return await this.s3Client.send(command);
  }

  /**
   * Get a pre-signed URL for an object (for direct browser access)
   * URLs are cached and valid for 1 hour
   */
  async getPresignedUrl(key: string): Promise<string> {
    // Check cache first
    const cached = this.urlCache.get(key);
    const now = Date.now();

    if (cached && cached.expires > now) {
      return cached.url;
    }

    // Generate new pre-signed URL (valid for 1 hour)
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

    // Cache the URL
    this.urlCache.set(key, {
      url,
      expires: now + (3600 * 1000) // 1 hour from now
    });

    console.log('Generated pre-signed URL for:', key);
    return url;
  }

  /**
   * Get object data from S3
   */
  async getObject(key: string): Promise<any> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    const response = await this.s3Client.send(command);
    return response;
  }
}
