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
    };

    this.oauthService.configure(authConfig);
    this.oauthService.setupAutomaticSilentRefresh();
  }

  private getRedirectUri(): string {
    // Read base href from DOM to handle both root (/) and subdirectory (/cat-view/) deployments
    const baseElement = document.querySelector('base');
    const baseHref = baseElement?.getAttribute('href') || '/';

    // Construct full redirect URI
    // baseHref is already absolute or starts with /, so we just need origin + baseHref + route
    const origin = window.location.origin;

    console.log('ret:', baseElement, baseHref, origin);

    // Remove trailing slash from baseHref if present, then add /signin
    const cleanBaseHref = baseHref.endsWith('/') ? baseHref.slice(0, -1) : baseHref;

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
}
