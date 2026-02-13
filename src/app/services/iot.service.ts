import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import mqtt, { MqttClient } from 'mqtt';
import { CognitoAuthService } from './cognito-auth.service';
import { environment } from '../../environments/environment';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface IoTMessage {
  topic: string;
  payload: any;
}

@Injectable({
  providedIn: 'root'
})
export class IoTService implements OnDestroy {
  private client: MqttClient | null = null;
  private activeSubscriptions = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  private messageSubject = new Subject<IoTMessage>();
  public onMessage$ = this.messageSubject.asObservable();

  public connectionStatus$ = new BehaviorSubject<ConnectionStatus>('disconnected');

  constructor(private cognitoAuthService: CognitoAuthService) {}

  async connect(): Promise<void> {
    if (this.client && this.connectionStatus$.getValue() === 'connected') {
      return; // Already connected
    }

    if (!environment.iot.endpoint) {
      throw new Error('IoT endpoint not configured. Please set IOT_ENDPOINT in your .env file.');
    }

    this.intentionalDisconnect = false;
    this.connectionStatus$.next('connecting');

    try {
      const signedUrl = await this.buildSignedUrl();

      // Disable built-in reconnect - we handle it manually to refresh the signed URL
      this.client = mqtt.connect(signedUrl, {
        reconnectPeriod: 0,
        connectTimeout: 10000,
        keepalive: 30,
        protocolVersion: 4,
      });

      this.client.on('connect', () => {
        console.log('IoT MQTT connected');
        this.connectionStatus$.next('connected');
        // Re-subscribe to topics after reconnect
        this.resubscribeAll();
      });

      this.client.on('message', (topic: string, payload: Buffer) => {
        console.log(`IoT message on ${topic}:`, payload.toString().substring(0, 200));
        try {
          const parsed = JSON.parse(payload.toString());
          this.messageSubject.next({ topic, payload: parsed });
        } catch (e) {
          console.error('Failed to parse IoT message:', e);
        }
      });

      this.client.on('error', (err: Error) => {
        console.error('IoT MQTT error:', err);
        this.connectionStatus$.next('error');
      });

      this.client.on('close', () => {
        console.log('IoT MQTT disconnected');
        if (!this.intentionalDisconnect) {
          this.connectionStatus$.next('disconnected');
          this.scheduleReconnect();
        }
      });
    } catch (err) {
      this.connectionStatus$.next('error');
      throw err;
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.activeSubscriptions.clear();
    this.connectionStatus$.next('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect || this.reconnectTimer) return;

    console.log('IoT MQTT: scheduling reconnect in 5s...');
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.intentionalDisconnect) return;

      try {
        // Clean up old client
        if (this.client) {
          this.client.end(true);
          this.client = null;
        }
        this.connectionStatus$.next('connecting');
        const signedUrl = await this.buildSignedUrl();

        this.client = mqtt.connect(signedUrl, {
          reconnectPeriod: 0,
          connectTimeout: 10000,
          keepalive: 30,
          protocolVersion: 4,
        });

        this.client.on('connect', () => {
          console.log('IoT MQTT reconnected');
          this.connectionStatus$.next('connected');
          this.resubscribeAll();
        });

        this.client.on('message', (topic: string, payload: Buffer) => {
          console.log(`IoT message on ${topic}:`, payload.toString().substring(0, 200));
          try {
            const parsed = JSON.parse(payload.toString());
            this.messageSubject.next({ topic, payload: parsed });
          } catch (e) {
            console.error('Failed to parse IoT message:', e);
          }
        });

        this.client.on('error', (err: Error) => {
          console.error('IoT MQTT reconnect error:', err);
          this.connectionStatus$.next('error');
        });

        this.client.on('close', () => {
          if (!this.intentionalDisconnect) {
            this.connectionStatus$.next('disconnected');
            this.scheduleReconnect();
          }
        });
      } catch (err) {
        console.error('IoT MQTT reconnect failed:', err);
        this.connectionStatus$.next('error');
        this.scheduleReconnect(); // Try again
      }
    }, 5000);
  }

  private resubscribeAll(): void {
    for (const topic of this.activeSubscriptions) {
      console.log(`IoT re-subscribing to ${topic}...`);
      this.client?.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          console.warn(`Failed to re-subscribe to ${topic}:`, err.message);
        } else {
          console.log(`IoT re-subscribed to ${topic}`);
        }
      });
    }
  }

  async publish(topic: string, message: object): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to IoT');
    }

    return new Promise<void>((resolve, reject) => {
      this.client!.publish(topic, JSON.stringify(message), { retain: false, qos: 0 }, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`IoT published to ${topic}:`, message);
          resolve();
        }
      });
    });
  }

  subscribe(topic: string): void {
    this.activeSubscriptions.add(topic);

    if (!this.client || this.connectionStatus$.getValue() !== 'connected') {
      // Will be subscribed on (re)connect via the connect handler
      return;
    }

    this.client.subscribe(topic, { qos: 0 }, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${topic}:`, err);
      } else {
        console.log(`IoT subscribed to ${topic}`);
      }
    });
  }

  unsubscribe(topic: string): void {
    this.activeSubscriptions.delete(topic);

    if (!this.client || this.connectionStatus$.getValue() !== 'connected') {
      // Already disconnected; topic removed from activeSubscriptions so it
      // won't be re-subscribed on reconnect
      return;
    }

    this.client.unsubscribe(topic, {}, (err) => {
      if (err) {
        console.error(`Failed to unsubscribe from ${topic}:`, err);
      } else {
        console.log(`IoT unsubscribed from ${topic}`);
      }
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  // --- SigV4 WebSocket URL signing ---

  private async buildSignedUrl(): Promise<string> {
    const credentials = await this.cognitoAuthService.getAwsCredentials();
    const endpoint = environment.iot.endpoint;
    const region = environment.aws.region;

    const now = new Date();
    const dateStamp = this.formatDateStamp(now);
    const amzDate = this.formatAmzDate(now);

    const service = 'iotdevicegateway';
    const scope = `${dateStamp}/${region}/${service}/aws4_request`;

    // Build canonical query string (parameters must be sorted)
    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${credentials.accessKeyId}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-SignedHeaders': 'host',
    };

    const canonicalQuerystring = Object.keys(queryParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    // Canonical request
    const canonicalRequest = [
      'GET',
      '/mqtt',
      canonicalQuerystring,
      `host:${endpoint}\n`,  // canonical headers + trailing newline
      'host',                 // signed headers
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // SHA256 of empty string
    ].join('\n');

    // String to sign
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      await this.sha256Hex(canonicalRequest)
    ].join('\n');

    // Signing key
    const signingKey = await this.getSignatureKey(
      credentials.secretAccessKey, dateStamp, region, service
    );

    // Signature
    const signature = await this.hmacSha256Hex(signingKey, stringToSign);

    // Build final URL
    let url = `wss://${endpoint}/mqtt?${canonicalQuerystring}&X-Amz-Signature=${signature}`;

    if (credentials.sessionToken) {
      url += `&X-Amz-Security-Token=${encodeURIComponent(credentials.sessionToken)}`;
    }

    return url;
  }

  private formatDateStamp(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  }

  private formatAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHmmssZ
  }

  private async hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  }

  private async hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
    const sig = await this.hmacSha256(key, data);
    return this.bufferToHex(sig);
  }

  private async sha256Hex(data: string): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return this.bufferToHex(hashBuffer);
  }

  private async getSignatureKey(
    key: string, dateStamp: string, region: string, service: string
  ): Promise<ArrayBuffer> {
    const kDate = await this.hmacSha256(new TextEncoder().encode('AWS4' + key).buffer as ArrayBuffer, dateStamp);
    const kRegion = await this.hmacSha256(kDate, region);
    const kService = await this.hmacSha256(kRegion, service);
    return this.hmacSha256(kService, 'aws4_request');
  }

  private bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
