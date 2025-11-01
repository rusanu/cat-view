import { Component } from '@angular/core';
import { UserProfileService } from '../../services/user-profile.service';
import { AsyncPipe, NgIf } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ActionConfigService } from '../../services/action-config.service';
import { ToggleButtonComponent } from '../toggle-button/toggle-button.component';

@Component({
  selector: 'app-action-bar',
  standalone: true,
  imports: [AsyncPipe, NgIf, ToggleButtonComponent],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.css'
})
export class ActionBarComponent {

  public get isAuthenticated$() {
    return this.authService.isAuthenticated$;
  }

  constructor(
    public userProfile:UserProfileService,
    public config: ActionConfigService,
    private authService: AuthService) {
  }

  public logout() {
    this.authService.logout();
  }

  rotateClockwise() {
    this.config.rotateClockwise();
  }

  rotateCounterClockwise() {
    this.config.rotateCounterClockwise();
  }

  resetRotation() {
    this.config.resetRotation();
  }
}
