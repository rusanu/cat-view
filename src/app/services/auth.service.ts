import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();

  constructor(
    private oauthService: OAuthService,
    private router: Router
  ) {
    this.configureOAuth();
  }

  private configureOAuth(): void {
    const authConfig: AuthConfig = {
      issuer: 'https://accounts.google.com',
      strictDiscoveryDocumentValidation: false,
      clientId: environment.google.clientId,
      redirectUri: this.getRedirectUri(),
      scope: 'openid profile email',
      showDebugInformation: !environment.production,
      // Use implicit flow for SPAs - it's designed for browser-based apps
      // Code flow with PKCE requires backend support for token refresh in practice
      responseType: 'id_token token',
      // Configure silent refresh (will use iframe with prompt=none)
      silentRefreshRedirectUri: this.getRedirectUri(),
      silentRefreshTimeout: 10000, // 10 second timeout for silent refresh
      // For Google, we need to use prompt=none for silent refresh attempts
      customQueryParams: {
        'access_type': 'online', // Online access for implicit flow
      }
    };

    this.oauthService.configure(authConfig);
    this.isAuthenticatedSubject.next(this.oauthService.hasValidAccessToken());

    // Listen for token events
    this.oauthService.events.subscribe(event => {
      if (event.type === 'token_received') {
        console.log('Token received successfully');
        this.isAuthenticatedSubject.next(true);
      } else if (event.type === 'token_error') {
        console.error('Token error:', event);
        // Token is invalid, user needs to re-authenticate
        if (this.router.url !== '/signin') {
          this.handleTokenRefreshError();
        }
      } else if (event.type === 'session_terminated' || event.type === 'session_error') {
        console.error('Session error:', event);
        this.handleTokenRefreshError();
      }
    });
  }

  private getRedirectUri(): string {
    // Read base href from DOM to handle both root (/) and subdirectory (/cat-view/) deployments
    const baseElement = document.querySelector('base');
    const baseHref = baseElement?.getAttribute('href') || '/';

    // Construct full redirect URI
    // baseHref is already absolute or starts with /, so we just need origin + baseHref + route
    const origin = window.location.origin;

    const cleanBaseHref = baseHref.endsWith('/') ? baseHref.slice(0, -1) : baseHref;
    console.log('ret:', baseElement, baseHref, cleanBaseHref, origin);

    // Remove trailing slash from baseHref if present, then add /signin

    //return `${origin}/cat-view/signin`
    return `${origin}${cleanBaseHref}/signin`;
  }

  public login(): void {
    this.oauthService.initLoginFlow();
  }

  public logout(): void {
    this.oauthService.logOut();
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/signin']);
  }

  public isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  public getAccessToken(): string {
    return this.oauthService.getAccessToken();
  }

  public getIdToken(): string {
    return this.oauthService.getIdToken();
  }

  public getUserProfile(): any {
    const claims = this.oauthService.getIdentityClaims();
    return claims;
  }

  public async handleLoginCallback(): Promise<boolean> {
    await this.oauthService.loadDiscoveryDocumentAndTryLogin();
    const isAuthenticated = this.oauthService.hasValidAccessToken();
    if (isAuthenticated) {
      this.isAuthenticatedSubject.next(true);
    }
    return isAuthenticated;
  }

  private handleTokenRefreshError(): void {
    // Token refresh failed, user needs to re-authenticate
    console.warn('Token refresh failed. Redirecting to login...');
    this.isAuthenticatedSubject.next(false);
    // Clear the failed tokens
    this.oauthService.logOut(true); // noRedirectToLogoutUrl = true
    // Redirect to signin page
    this.router.navigate(['/signin']);
  }

  /**
   * Check if the current token is expired or about to expire
   * @param bufferSeconds Number of seconds before expiration to consider token as expired (default: 300 = 5 minutes)
   */
  public isTokenExpiringSoon(bufferSeconds: number = 300): boolean {
    const expiresAt = this.oauthService.getAccessTokenExpiration();
    if (!expiresAt) {
      return true; // No expiration means no valid token
    }
    const now = Date.now();
    const bufferMs = bufferSeconds * 1000;
    return expiresAt < (now + bufferMs);
  }

  /**
   * Manually trigger a token refresh using silent refresh (iframe with prompt=none)
   * Note: This may fail if user's Google session has expired or requires interaction
   */
  public async refreshToken(): Promise<boolean> {
    try {
      console.log('Attempting silent token refresh...');

      // Try silent refresh with Google (uses iframe with prompt=none)
      await this.oauthService.silentRefresh({
        customQueryParams: {
          'prompt': 'none' // Don't show UI, fail if interaction needed
        }
      });

      const hasValidToken = this.oauthService.hasValidAccessToken();

      if (hasValidToken) {
        console.log('Token refreshed successfully via silent refresh');
        this.isAuthenticatedSubject.next(true);
      }

      return hasValidToken;
    } catch (error: any) {
      console.warn('Silent token refresh failed:', error);

      // Silent refresh failed - this is expected if:
      // - User's Google session expired
      // - User needs to grant consent again
      // - User is in incognito mode
      // - Third-party cookies are blocked

      // Don't call handleTokenRefreshError here - let the caller decide
      // This prevents automatic redirects during proactive refresh attempts
      return false;
    }
  }

  /**
   * Check if we have a refresh token
   * Note: Implicit flow doesn't provide refresh tokens
   */
  public hasRefreshToken(): boolean {
    return !!this.oauthService.getRefreshToken();
  }
}
