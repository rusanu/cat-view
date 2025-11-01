import { Injectable, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from './auth.service';
import { GravatarService } from './gravatar.service';
import { BehaviorSubject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class UserProfileService {

  public displayName$ = new BehaviorSubject<string | null>(null);
  public email$ = new BehaviorSubject<string | null>(null);
  public avatarUrl$ = new BehaviorSubject<string|null>(null);

  constructor(public authService:AuthService, public gravatarService:GravatarService) {
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        const claims = this.authService.getUserProfile();
        const email = claims['email'];
        this.displayName$.next(claims['name'] || email);
        this.email$.next(email);
        if (email) {
          this.avatarUrl$.next(this.gravatarService.getAvatarUrl(email));
        }
        else  {
          this.avatarUrl$.next(null);
        }
      }
      else {
        this.displayName$.next(null);
        this.avatarUrl$.next(null)
      }
    })
  }
}
