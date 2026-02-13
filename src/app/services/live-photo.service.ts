import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, filter, takeUntil } from 'rxjs';
import { IoTService } from './iot.service';
import { S3Service } from './s3.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LivePhotoService implements OnDestroy {
  public livePhotoUrl$ = new BehaviorSubject<string | null>(null);
  public isLiveActive$ = new BehaviorSubject<boolean>(false);
  public isLiveConnecting$ = new BehaviorSubject<boolean>(false);
  public liveError$ = new BehaviorSubject<string | null>(null);

  private commandTopic: string;
  private livePhotoTopic: string;
  private destroy$ = new Subject<void>();

  constructor(
    private iotService: IoTService,
    private s3Service: S3Service
  ) {
    const cameraId = environment.iot.cameraId;
    this.commandTopic = `cat-shelter/${cameraId}/commands`;
    this.livePhotoTopic = `cat-shelter/${cameraId}/live-photo`;

    // Listen for live-photo messages from IoT
    this.iotService.onMessage$.pipe(
      takeUntil(this.destroy$),
      filter(msg => msg.topic === this.livePhotoTopic)
    ).subscribe(async msg => {
      await this.handleLivePhotoMessage(msg.payload);
    });
  }

  async startLivePhoto(): Promise<void> {
    this.liveError$.next(null);
    this.isLiveConnecting$.next(true);

    try {
      // Connect to IoT if not already connected
      await this.iotService.connect();

      // Subscribe to the live photo response topic
      this.iotService.subscribe(this.livePhotoTopic);

      // Send the live-photo command (non-retained, idempotent)
      await this.iotService.publish(this.commandTopic, { command: 'live-photo' });

      this.isLiveActive$.next(true);
    } catch (err: any) {
      this.liveError$.next(err.message || 'Failed to start live photo');
      this.isLiveActive$.next(false);
      throw err;
    } finally {
      this.isLiveConnecting$.next(false);
    }
  }

  stopLivePhoto(): void {
    if (this.isLiveActive$.getValue()) {
      this.iotService.unsubscribe(this.livePhotoTopic);
      this.isLiveActive$.next(false);
      this.livePhotoUrl$.next(null);
      this.liveError$.next(null);
    }
  }

  private async handleLivePhotoMessage(payload: { id: string }): Promise<void> {
    if (!payload.id || !this.isLiveActive$.getValue()) return;

    try {
      const url = await this.s3Service.getPresignedUrl(payload.id);
      this.livePhotoUrl$.next(url);
    } catch (err: any) {
      console.error('Failed to get pre-signed URL for live photo:', err);
    }
  }

  ngOnDestroy(): void {
    this.stopLivePhoto();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
