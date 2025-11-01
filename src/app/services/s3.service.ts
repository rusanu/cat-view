import { Injectable } from '@angular/core';
import { S3Client, ListObjectsV2Command, GetObjectCommand, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { environment } from '../../environments/environment.development';
import { CognitoAuthService } from './cognito-auth.service';

@Injectable({
  providedIn: 'root'
})
export class S3Service {
  private bucketName: string;
  private bucketFolder: string;
  private urlCache: Map<string, { url: string, expires: number }> = new Map();

  constructor(
    private cognitoAuthService: CognitoAuthService
  ) {
    this.bucketName = environment.aws.bucketName;
    this.bucketFolder = environment.aws.bucketFolder;

    // Validate that Cognito is configured
    if (!environment.cognito.identityPoolId) {
      throw new Error(
        'Cognito Identity Pool ID is required. Please configure COGNITO_IDENTITY_POOL_ID in your .env file. ' +
        'Static AWS credentials are no longer supported for security reasons.'
      );
    }
  }

  /**
   * Clears all caches (useful when logging out)
   */
  clearCaches(): void {
    this.urlCache.clear();
    this.cognitoAuthService.clearCredentials();
  }

  /**
   * Gets or creates the S3 client with Cognito credentials
   */
  private async getS3Client(): Promise<S3Client> {
    // Use Cognito credentials - always create a new client to ensure fresh credentials
    const credentials = await this.cognitoAuthService.getAwsCredentials();

    return new S3Client({
      region: environment.aws.region,
      credentials: credentials
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

    const client = await this.getS3Client();
    return await client.send(command);
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

    const client = await this.getS3Client();
    const url = await getSignedUrl(client, command, { expiresIn: 3600 });

    // Cache the URL
    this.urlCache.set(key, {
      url,
      expires: now + (3600 * 1000) // 1 hour from now
    });

    //console.log('Generated pre-signed URL for:', key);
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

    const client = await this.getS3Client();
    const response = await client.send(command);
    return response;
  }
}
