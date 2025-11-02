import { Component, EventEmitter, Output } from '@angular/core';
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
  @Output() refresh = new EventEmitter<void>();

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

  emitRefresh() {
    this.refresh.emit();
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

  onBrightnessChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const level = parseInt(input.value, 10);
    this.config.brightnessLevel$.next(level);
  }
}
