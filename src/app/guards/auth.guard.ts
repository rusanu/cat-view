import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Check if we're already showing an auth error (token expired)
  // In this case, allow access to show cached photos with error banner
  let hasAuthError = false;
  authService.authError$.subscribe(error => hasAuthError = !!error).unsubscribe();

  if (hasAuthError) {
    // Allow access but user will see auth error banner
    return true;
  }

  // No token and no auth error - user never logged in
  // Redirect to signin page
  router.navigate(['/signin']);
  return false;
};
