import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();

  private authErrorSubject = new BehaviorSubject<string | null>(null);
  public authError$: Observable<string | null> = this.authErrorSubject.asObservable();

  private expiredTokenSubject = new Subject<void>();
  public expiredToken$:Observable<void> = this.expiredTokenSubject.asObservable();

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
        this.authErrorSubject.next(null); // Clear any auth errors
      } else if (event.type === 'token_error') {
        console.error('Token error:', event);
        // Token is invalid, user needs to re-authenticate
        if (this.router.url !== '/signin') {
          this.handleTokenRefreshError();
        }
      } else if (event.type === 'session_terminated' || event.type === 'session_error') {
        console.error('Session error:', event);
        this.handleTokenRefreshError();
      } else if (event.type == "token_expires") {
        console.warn("OAuth token has expired");
        this.isAuthenticatedSubject.next(false);
        this.authErrorSubject.next("Token has expired"); 
        this.expiredTokenSubject.next();
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

    // Remove trailing slash from baseHref if present, then add /signin

    return `${origin}${cleanBaseHref}/signin`;
  }

  public login(): void {
    this.oauthService.initLoginFlow();
  }

  public logout(): void {
    this.oauthService.logOut();
    this.isAuthenticatedSubject.next(false);
    this.authErrorSubject.next(null);
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
    console.warn('Token refresh failed. Showing auth error banner...');
    this.isAuthenticatedSubject.next(false);
    // Set auth error message instead of redirecting
    this.authErrorSubject.next('Sesiunea ta a expirat. Te rugăm să te autentifici din nou.');
    // Clear the failed tokens but don't redirect
    this.oauthService.logOut(true); // noRedirectToLogoutUrl = true
    // Only redirect if we're on the signin page already
    if (this.router.url === '/signin') {
      this.router.navigate(['/signin']);
    }
  }

  public reAuthenticate(): void {
    this.logout();
  }
}
