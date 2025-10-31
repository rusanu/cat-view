import { Injectable } from '@angular/core';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import { AwsCredentialIdentity } from '@aws-sdk/types';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CognitoAuthService {
  private cachedCredentials: AwsCredentialIdentity | null = null;

  constructor(private authService: AuthService) { }

  /**
   * Gets AWS credentials from Cognito Identity Pool using the Google OIDC token
   * @returns Promise of AWS credentials
   */
  async getAwsCredentials(): Promise<AwsCredentialIdentity> {
    // If we have cached credentials that are still valid, return them
    if (this.cachedCredentials && this.isCredentialValid(this.cachedCredentials)) {
      return this.cachedCredentials;
    }

    // Check if the OAuth token is expired or about to expire
    if (this.authService.isTokenExpiringSoon()) {
      console.log('OAuth token is expiring soon, attempting refresh...');
      const refreshed = await this.authService.refreshToken();
      if (!refreshed) {
        throw new Error('Failed to refresh OAuth token. Please sign in again.');
      }
    }

    // Get the Google ID token from the auth service
    const idToken = this.authService.getIdToken();

    if (!idToken) {
      throw new Error('No Google ID token available. Please sign in first.');
    }

    if (!environment.cognito.identityPoolId) {
      throw new Error('Cognito Identity Pool ID not configured in environment.');
    }

    try {
      // Create credential provider using Cognito Identity Pool
      const credentialProvider = fromCognitoIdentityPool({
        clientConfig: { region: environment.aws.region },
        identityPoolId: environment.cognito.identityPoolId,
        logins: {
          'accounts.google.com': idToken
        }
      });

      // Get credentials
      this.cachedCredentials = await credentialProvider();
      return this.cachedCredentials;
    } catch (error) {
      console.error('Error getting AWS credentials from Cognito:', error);

      // If the error is related to token validation, try refreshing the token once
      if (error instanceof Error && (
        error.message.includes('Token') ||
        error.message.includes('Invalid') ||
        error.message.includes('expired')
      )) {
        console.log('Token error detected, attempting refresh...');
        const refreshed = await this.authService.refreshToken();
        if (refreshed) {
          // Retry with the new token
          const newIdToken = this.authService.getIdToken();
          if (newIdToken) {
            const retryProvider = fromCognitoIdentityPool({
              clientConfig: { region: environment.aws.region },
              identityPoolId: environment.cognito.identityPoolId,
              logins: {
                'accounts.google.com': newIdToken
              }
            });
            this.cachedCredentials = await retryProvider();
            return this.cachedCredentials;
          }
        }
      }

      throw new Error('Failed to get AWS credentials from Cognito Identity Pool');
    }
  }

  /**
   * Checks if the credentials are still valid
   * @param credentials The credentials to check
   * @returns true if credentials are valid
   */
  private isCredentialValid(credentials: AwsCredentialIdentity): boolean {
    if (!credentials.expiration) {
      return true; // No expiration means always valid
    }

    // Check if expiration is more than 5 minutes in the future
    const expirationTime = credentials.expiration.getTime();
    const now = new Date().getTime();
    const fiveMinutes = 5 * 60 * 1000;

    return expirationTime > (now + fiveMinutes);
  }

  /**
   * Clears cached credentials (useful when logging out)
   */
  clearCredentials(): void {
    this.cachedCredentials = null;
  }
}
