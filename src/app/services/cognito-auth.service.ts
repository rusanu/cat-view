import { EventEmitter, Injectable } from '@angular/core';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import { AwsCredentialIdentity } from '@aws-sdk/types';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, Subject, Subscription, takeUntil, timer } from 'rxjs';

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
    const now = Date.now();

    // If we have cached credentials that are still valid, return them
    if (this.cachedCredentials && ((this.cachedCredentials.expiration?.getTime() ?? now) >= now)) {
      return this.cachedCredentials;
    }

    // Get the Google ID token from the auth service
    const idToken = this.authService.getIdToken();

    if (!idToken) {
      throw new Error('No Google ID token available. Please sign in first.');
    }

    if (!environment.cognito.identityPoolId) {
      throw new Error('Cognito Identity Pool ID not configured in environment.');
    }

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
      console.log('Cognito:', this.cachedCredentials);

      return this.cachedCredentials;
  }

  /**
   * Clears cached credentials (useful when logging out)
   */
  clearCredentials(): void {
    this.cachedCredentials = null;
  }
}
