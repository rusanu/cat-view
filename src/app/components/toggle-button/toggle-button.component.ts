import { NgIf } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'button[app-toggle]',
  standalone: true,
  imports: [NgIf],
  templateUrl: './toggle-button.component.html',
  styleUrl: './toggle-button.component.css',
  host: {
    // Set static attributes
    'type': 'button',
    'role': 'switch',

    // Set static classes
    'class': 'toggle-btn',

    // Bind to component properties
    '[class.active]': 'isOn',
    '[attr.aria-pressed]': 'isOn',

    // Listen to events on the host
    '(click)': 'toggle()'
}})
export class ToggleButtonComponent implements OnInit, OnDestroy {
  @Input() data$!: Subject<boolean>;
  @Input() title!: string;

  private destroy$ = new Subject<void>();

  public isOn: boolean = false;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.data$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => this.isOn = value);
  }

  toggle() {
    this.data$.next(!this.isOn);
  }

}
