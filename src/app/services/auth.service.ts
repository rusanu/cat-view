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
      // Enable automatic silent refresh when token is about to expire
      silentRefreshRedirectUri: this.getRedirectUri(),
      // Use prompt=none for silent refresh
      silentRefreshShowIFrame: false,
      // Session checks to detect changes in auth state
      sessionChecksEnabled: true,
      // Timeout for silent refresh (ms)
      silentRefreshTimeout: 20000,
    };

    this.oauthService.configure(authConfig);
    this.oauthService.setupAutomaticSilentRefresh();

    // Listen for token refresh events
    this.oauthService.events.subscribe(event => {
      if (event.type === 'token_received' || event.type === 'token_refreshed') {
        console.log('Token refreshed successfully');
        this.isAuthenticatedSubject.next(true);
      } else if (event.type === 'token_refresh_error') {
        console.error('Token refresh failed:', event);
        this.handleTokenRefreshError();
      } else if (event.type === 'silent_refresh_error') {
        console.error('Silent refresh error:', event);
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

    return `${origin}/cat-view/signin`
    //return `${origin}${cleanBaseHref}/signin`;
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
   * Manually trigger a token refresh
   */
  public async refreshToken(): Promise<boolean> {
    try {
      await this.oauthService.silentRefresh();
      return this.oauthService.hasValidAccessToken();
    } catch (error) {
      console.error('Manual token refresh failed:', error);
      this.handleTokenRefreshError();
      return false;
    }
  }
}
