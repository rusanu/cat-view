import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.css'
})
export class SigninComponent implements OnInit {
  isProcessing = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    // Check if this is an OAuth callback (has code or state in URL)
    const hasOAuthParams = this.route.snapshot.queryParams['code'] ||
                           this.route.snapshot.queryParams['state'];

    if (hasOAuthParams) {
      // Handle OAuth callback and wait for completion
      this.isProcessing = true;
      const success = await this.authService.handleLoginCallback();
      if (success) {
        // Successfully authenticated, redirect to home
        this.router.navigate(['/']);
      } else {
        // Failed to authenticate, show error (stay on sign-in page)
        this.isProcessing = false;
      }
    } else {
      // Not a callback - check if already authenticated
      // First try to load any existing tokens
      const isAuth = await this.authService.handleLoginCallback();
      if (isAuth) {
        // Already authenticated, redirect to home
        this.router.navigate(['/']);
      }
      // Otherwise stay on sign-in page and wait for user to click button
    }
  }

  login(): void {
    this.authService.login();
  }
}
