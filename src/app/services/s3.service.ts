import { Injectable } from '@angular/core';
import { S3Client, ListObjectsV2Command, GetObjectCommand, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private bucketFolder: string;

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
   * Get a signed URL for an object (for direct browser access)
   */
  getObjectUrl(key: string): string {
    return `https://${this.bucketName}.s3.${environment.aws.region}.amazonaws.com/${key}`;
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
