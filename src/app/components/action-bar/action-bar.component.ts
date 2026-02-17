import { Component, EventEmitter, Output } from '@angular/core';
import { UserProfileService } from '../../services/user-profile.service';
import { AsyncPipe, NgIf } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ActionConfigService } from '../../services/action-config.service';
import { ToggleButtonComponent } from '../toggle-button/toggle-button.component';
import { IoTService } from '../../services/iot.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-action-bar',
  standalone: true,
  imports: [AsyncPipe, NgIf, ToggleButtonComponent],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.css'
})
export class ActionBarComponent {
  @Output() refresh = new EventEmitter<void>();

  snapshotSending = false;

  public get isAuthenticated$() {
    return this.authService.isAuthenticated$;
  }

  public get authError$() {
    return this.authService.authError$;
  }

  constructor(
    public userProfile:UserProfileService,
    public config: ActionConfigService,
    private authService: AuthService,
    private iotService: IoTService) {
  }

  public logout() {
    this.authService.logout();
  }

  public reAuthenticate() {
    this.authService.reAuthenticate();
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

  async sendSnapshot() {
    if (this.snapshotSending) return;
    this.snapshotSending = true;
    try {
      await this.iotService.connect();
      const commandTopic = `cat-shelter/${environment.iot.cameraId}/commands`;
      await this.iotService.publish(commandTopic, { command: 'snapshot' });
    } catch (err) {
      console.error('Failed to send snapshot command:', err);
    } finally {
      this.snapshotSending = false;
    }
  }
}

