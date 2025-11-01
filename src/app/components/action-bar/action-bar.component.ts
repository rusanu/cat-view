import { Component } from '@angular/core';
import { UserProfileService } from '../../services/user-profile.service';
import { AsyncPipe, NgIf } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-action-bar',
  standalone: true,
  imports: [AsyncPipe, NgIf],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.css'
})
export class ActionBarComponent {

  public get isAuthenticated$() {
    return this.authService.isAuthenticated$;
  }

  constructor(public userProfile:UserProfileService, private authService: AuthService) {

  }

  public logout() {
    this.authService.logout();
  }
}
