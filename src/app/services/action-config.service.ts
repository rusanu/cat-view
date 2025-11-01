import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const INITIAL_ROTATION = 90;

@Injectable({
  providedIn: 'root'
})
export class ActionConfigService {

  public autoRefresh$ = new BehaviorSubject<boolean>(true);
  public rotation$ = new BehaviorSubject<number>(INITIAL_ROTATION);
  public showGrid$ = new BehaviorSubject<boolean>(true);

  constructor() {

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
