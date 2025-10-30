import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

@Component({
  selector: 'app-date-range-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './date-range-selector.component.html',
  styleUrl: './date-range-selector.component.css'
})
export class DateRangeSelectorComponent {
  @Output() dateRangeChanged = new EventEmitter<DateRange>();

  startDateStr: string = '';
  endDateStr: string = '';

  constructor() {
    // Initialize with last 24 hours
    this.setLast24Hours();
  }

  setLast24Hours() {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    this.startDateStr = this.formatDateForInput(yesterday);
    this.endDateStr = this.formatDateForInput(now);
    this.emitDateRange();
  }

  setLast7Days() {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    this.startDateStr = this.formatDateForInput(weekAgo);
    this.endDateStr = this.formatDateForInput(now);
    this.emitDateRange();
  }

  setLast30Days() {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    this.startDateStr = this.formatDateForInput(monthAgo);
    this.endDateStr = this.formatDateForInput(now);
    this.emitDateRange();
  }

  setToday() {
    const now = new Date();
    this.startDateStr = this.formatDateForInput(now);
    this.endDateStr = this.formatDateForInput(now);
    this.emitDateRange();
  }

  onDateChange() {
    if (this.startDateStr && this.endDateStr) {
      this.emitDateRange();
    }
  }

  private emitDateRange() {
    const startDate = this.parseDateInput(this.startDateStr);
    const endDate = this.parseDateInput(this.endDateStr);

    // Set end date to end of day (23:59:59)
    endDate.setHours(23, 59, 59, 999);

    this.dateRangeChanged.emit({ startDate, endDate });
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDateInput(dateStr: string): Date {
    // Parse YYYY-MM-DD format and create date at midnight local time
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
}
