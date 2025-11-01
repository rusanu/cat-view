import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-toggle-button',
  standalone: true,
  imports: [],
  templateUrl: './toggle-button.component.html',
  styleUrl: './toggle-button.component.css',
  host: {
    class: 'form-switch'
  }
})
export class ToggleButtonComponent implements OnInit, OnDestroy {
  @Input() data$!: Subject<boolean>;
  @Input() title!: string;

  private destroy$ = new Subject<void>();

  public isOn: boolean = false;

  public id: string = `id-${Math.random().toString(36).substr(2, 9)}`;

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
