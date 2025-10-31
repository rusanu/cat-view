import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { GravatarService } from './services/gravatar.service';
import { S3Service } from './services/s3.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Cat View';
  userProfile: any = null;
  isAuthenticated = false;

  constructor(
    public authService: AuthService,
    public gravatarService: GravatarService,
    private s3Service: S3Service
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated$.subscribe(isAuth => {
      this.isAuthenticated = isAuth;
      if (isAuth) {
        this.userProfile = this.authService.getUserProfile();
      }
    });

    // Check current authentication status
    if (this.authService.isAuthenticated()) {
      this.isAuthenticated = true;
      this.userProfile = this.authService.getUserProfile();
    }
  }

  logout(): void {
    // Clear S3 and Cognito caches before logging out
    this.s3Service.clearCaches();
    this.authService.logout();
  }

  getAvatarUrl(): string {
    return this.gravatarService.getAvatarUrl(this.userProfile?.email);
  }
}
