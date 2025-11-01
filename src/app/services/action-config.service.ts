import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const INITIAL_ROTATION = 90;

const STORAGE_KEY="action-config-service";

interface IConfig {
  autoRefresh: boolean;
  showGrid: boolean;
  rotation: number;
}

@Injectable({
  providedIn: 'root'
})
export class ActionConfigService {

  public autoRefresh$ = new BehaviorSubject<boolean>(true);
  public rotation$ = new BehaviorSubject<number>(INITIAL_ROTATION);
  public showGrid$ = new BehaviorSubject<boolean>(true);

  private config: IConfig = {
    autoRefresh: true,
    rotation: INITIAL_ROTATION,
    showGrid: true
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
    })

    this.rotation$.subscribe(value => {
      this.config.rotation = value;
      this.saveConfig();
    })
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
