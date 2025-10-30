import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Photo } from '../../services/photo.service';
import { MetadataService, PhotoMetadata } from '../../services/metadata.service';

Chart.register(...registerables);

interface GraphDataPoint {
  timestamp: Date;
  temperature?: number;
  humidity?: number;
  blanketOn?: boolean;
  catPresent?: boolean;
  uptime?: number;
  isReboot?: boolean;
}

@Component({
  selector: 'app-photo-graphs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-graphs.component.html',
  styleUrl: './photo-graphs.component.css'
})
export class PhotoGraphsComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() photos: Photo[] = [];
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private retryCount = 0;
  private readonly MAX_RETRIES = 10;
  loading = false;
  loadingProgress = 0;
  loadingTotal = 0;
  error: string | null = null;
  warning: string | null = null;

  constructor(private metadataService: MetadataService) {}

  ngAfterViewInit() {
    // Initialize empty chart immediately
    setTimeout(() => this.initializeChart(), 0);
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['photos']) {
      // Reinitialize chart with new photo set
      setTimeout(() => {
        this.initializeChart();
        this.loadMetadataProgressively();
      }, 0);
    }
  }

  private initializeChart() {
    if (!this.chartCanvas?.nativeElement) {
      console.warn('Canvas not available for chart initialization');
      return;
    }

    // Destroy existing chart if any
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    // Create empty chart immediately
    this.createEmptyChart();

    // Start loading metadata if we have photos
    if (this.photos.length > 0) {
      this.loadMetadataProgressively();
    }
  }

  private async loadMetadataProgressively() {
    if (!this.chart) {
      console.warn('Chart not initialized, cannot load data');
      return;
    }

    this.loading = true;
    this.loadingProgress = 0;
    this.loadingTotal = this.photos.length;
    this.error = null;
    this.warning = null;

    const BATCH_SIZE = 5;
    const dataPoints: GraphDataPoint[] = [];
    let failedCount = 0;
    let previousUptime: number | undefined;

    try {
      // Process photos in batches of 5
      for (let i = 0; i < this.photos.length; i += BATCH_SIZE) {
        const batch = this.photos.slice(i, i + BATCH_SIZE);

        // Fetch batch in parallel
        const results = await Promise.allSettled(
          batch.map(photo => this.metadataService.getMetadata(photo.key))
        );

        // Process results
        for (let j = 0; j < results.length; j++) {
          const photo = batch[j];
          const result = results[j];

          this.loadingProgress++;

          if (result.status === 'fulfilled' && result.value) {
            const metadata = result.value;

            // Cat is considered present if motion was detected within last 5 minutes (300 seconds)
            const catPresent = metadata.seconds_since_last_motion < 300;

            const point: GraphDataPoint = {
              timestamp: photo.timestamp,
              temperature: metadata.temperature_celsius,
              humidity: metadata.humidity_percent,
              blanketOn: metadata.blanket_on,
              catPresent: catPresent,
              uptime: metadata.uptime_seconds
            };

            // Detect reboot (uptime decreased)
            if (previousUptime !== undefined && metadata.uptime_seconds < previousUptime) {
              point.isReboot = true;
            }
            previousUptime = metadata.uptime_seconds;

            dataPoints.push(point);
          } else {
            failedCount++;
          }
        }

        // Update chart after each batch
        if (dataPoints.length > 0) {
          // Sort by timestamp before updating
          dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          this.updateChartData(dataPoints);
        }
      }

      // Final status
      if (failedCount > 0) {
        this.warning = `${failedCount} of ${this.photos.length} metadata files failed to load. Showing partial data.`;
      }

      if (dataPoints.length === 0) {
        this.error = 'No valid metadata found. All metadata files may be corrupted or missing.';
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
      this.error = 'Failed to load graph data';
    } finally {
      this.loading = false;
    }
  }

  private createEmptyChart() {
    if (!this.chartCanvas?.nativeElement) {
      console.warn('Chart canvas not available');
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Temperature (°C)',
            data: [],
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y',
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            label: 'Humidity (%)',
            data: [],
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            yAxisID: 'y',
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            label: 'Cat Present',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            yAxisID: 'y1',
            stepped: true,
            pointRadius: 0,
            borderWidth: 2,
            fill: true
          },
          {
            label: 'Blanket On',
            data: [],
            borderColor: 'rgb(255, 206, 86)',
            backgroundColor: 'rgba(255, 206, 86, 0.2)',
            yAxisID: 'y1',
            stepped: true,
            pointRadius: 0,
            borderWidth: 2,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: 'Sensor Data Over Time'
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const date = items[0].parsed.x;
                if (date !== null && date !== undefined) {
                  return new Date(date).toLocaleString();
                }
                return '';
              }
            }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'hour',
              displayFormats: {
                hour: 'MMM d, HH:mm'
              }
            },
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Temperature (°C) / Humidity (%)'
            },
            min: 0,
            max: 100
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Status (Cat/Blanket)'
            },
            min: 0,
            max: 1,
            ticks: {
              stepSize: 1,
              callback: function(value) {
                return value === 1 ? 'YES' : 'NO';
              }
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  private updateChartData(dataPoints: GraphDataPoint[]) {
    if (!this.chart) {
      console.warn('Chart not initialized, cannot update data');
      return;
    }

    // Update labels and datasets
    this.chart.data.labels = dataPoints.map(p => p.timestamp);

    // Temperature dataset
    this.chart.data.datasets[0].data = dataPoints.map(p => p.temperature ?? null);

    // Humidity dataset
    this.chart.data.datasets[1].data = dataPoints.map(p => p.humidity ?? null);

    // Cat Present dataset
    this.chart.data.datasets[2].data = dataPoints.map(p => p.catPresent ? 1 : 0);

    // Blanket On dataset
    this.chart.data.datasets[3].data = dataPoints.map(p => p.blanketOn ? 1 : 0);

    // Update the chart with new data (mode 'none' for smoother updates)
    this.chart.update('none');
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
