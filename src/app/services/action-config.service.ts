import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const INITIAL_ROTATION = 90;

const STORAGE_KEY="action-config-service";

interface IConfig {
  autoRefresh: boolean;
  showGrid: boolean;
  rotation: number;
  showMetadata: boolean;
  brightnessLevel: number; // 1-5, where 1=normal, 5=very bright
}

@Injectable({
  providedIn: 'root'
})
export class ActionConfigService {

  public autoRefresh$ = new BehaviorSubject<boolean>(true);
  public rotation$ = new BehaviorSubject<number>(INITIAL_ROTATION);
  public showGrid$ = new BehaviorSubject<boolean>(true);
  public showMetdata$ = new BehaviorSubject<boolean>(false);
  public brightnessLevel$ = new BehaviorSubject<number>(3); // Default 3 (moderate boost for night photos)

  private config: IConfig = {
    autoRefresh: true,
    rotation: INITIAL_ROTATION,
    showGrid: true,
    showMetadata: false,
    brightnessLevel: 3
  };

  constructor() {
    try{
      const configString = localStorage.getItem(STORAGE_KEY);

      if (configString) {
        const configJson = JSON.parse(configString);
        const filtered = Object.fromEntries(
            Object.entries(configJson).filter(([_, v]) => v !== undefined)
        );

        this.config = {...this.config, ...filtered};

        this.autoRefresh$.next(this.config.autoRefresh);
        this.rotation$.next(this.config.rotation);
        this.showGrid$.next(this.config.showGrid);
        this.showMetdata$.next(this.config.showMetadata);
        this.brightnessLevel$.next(this.config.brightnessLevel);
        }
    }
    catch(err) {
      console.error("failed to load config:", err);
    }

    // Important: subscribe *after* our own changes in read
    this.autoRefresh$.subscribe(value => {
      this.config.autoRefresh = value;
      this.saveConfig();
    });

    this.showGrid$.subscribe(value => {
      this.config.showGrid = value;
      this.saveConfig();
    });

    this.rotation$.subscribe(value => {
      this.config.rotation = value;
      this.saveConfig();
    });

    this.showMetdata$.subscribe(value => {
      this.config.showMetadata = value;
      this.saveConfig();
    });

    this.brightnessLevel$.subscribe(value => {
      this.config.brightnessLevel = value;
      this.saveConfig();
    });
  }

  private saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
  }

  public rotateClockwise() {
    this.rotation$.next((this.rotation$.getValue() + 90) % 360);
  }

  rotateCounterClockwise() {
    this.rotation$.next((this.rotation$.getValue() - 90 + 360) % 360);
  }

  resetRotation() {
    this.rotation$.next(INITIAL_ROTATION);
  }
}
