import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
export class PhotoGraphsComponent implements OnChanges, AfterViewInit {
  @Input() photos: Photo[] = [];
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  loading = false;
  loadingProgress = 0;
  loadingTotal = 0;
  error: string | null = null;
  warning: string | null = null;

  constructor(private metadataService: MetadataService) {}

  ngAfterViewInit() {
    if (this.photos.length > 0) {
      this.updateChart();
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['photos'] && this.chartCanvas) {
      await this.updateChart();
    }
  }

  async updateChart() {
    if (!this.chartCanvas || this.photos.length === 0) {
      return;
    }

    this.loading = true;
    this.loadingProgress = 0;
    this.loadingTotal = this.photos.length;
    this.error = null;
    this.warning = null;

    try {
      // Load metadata for all photos
      const dataPoints: GraphDataPoint[] = [];
      let previousUptime: number | undefined;
      let failedCount = 0;

      for (const photo of this.photos) {
        try {
          const metadata = await this.metadataService.getMetadata(photo.key);
          this.loadingProgress++;

          if (metadata) {
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
        } catch (error) {
          console.warn('Failed to load metadata for', photo.key, error);
          this.loadingProgress++;
          failedCount++;
        }
      }

      // Sort by timestamp
      dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Show warning if some data points failed but we still have data
      if (failedCount > 0) {
        this.warning = `${failedCount} of ${this.photos.length} metadata files failed to load (corrupted or missing). Showing partial data.`;
      }

      // Only show error if we have no data at all
      if (dataPoints.length === 0) {
        this.error = 'No valid metadata found. All metadata files may be corrupted or missing.';
        return;
      }

      // Create the chart with whatever data we have
      this.createChart(dataPoints);
    } catch (error) {
      console.error('Error updating chart:', error);
      this.error = 'Failed to load graph data';
    } finally {
      this.loading = false;
    }
  }

  private createChart(dataPoints: GraphDataPoint[]) {
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = dataPoints.map(p => p.timestamp);

    // Prepare datasets
    const temperatureData = dataPoints.map(p => p.temperature ?? null);
    const humidityData = dataPoints.map(p => p.humidity ?? null);
    const blanketData = dataPoints.map(p => p.blanketOn ? 1 : 0);
    const catPresentData = dataPoints.map(p => p.catPresent ? 1 : 0);

    // Find reboot indices
    const rebootIndices = dataPoints
      .map((p, i) => p.isReboot ? i : -1)
      .filter(i => i >= 0);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Temperature (°C)',
            data: temperatureData,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y',
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            label: 'Humidity (%)',
            data: humidityData,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            yAxisID: 'y',
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            label: 'Cat Present',
            data: catPresentData,
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
            data: blanketData,
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
              },
              afterBody: (items) => {
                const index = items[0].dataIndex;
                if (rebootIndices.includes(index)) {
                  return ['⚠️ System Reboot Detected'];
                }
                return [];
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

    // Add reboot markers as vertical lines
    if (rebootIndices.length > 0 && this.chart) {
      const plugin = {
        id: 'rebootMarkers',
        afterDraw: (chart: Chart) => {
          const ctx = chart.ctx;
          const xAxis = chart.scales['x'];
          const yAxis = chart.scales['y'];

          rebootIndices.forEach(index => {
            const x = xAxis.getPixelForValue(labels[index].getTime());

            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, yAxis.top);
            ctx.lineTo(x, yAxis.bottom);
            ctx.stroke();
            ctx.restore();
          });
        }
      };

      this.chart.options.plugins = this.chart.options.plugins || {};
      Chart.register(plugin);
    }
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
