import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { S3Service } from '../../services/s3.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  connectionStatus: 'testing' | 'success' | 'error' = 'testing';
  errorMessage: string = '';
  objectCount: number = 0;
  sampleObjects: string[] = [];

  constructor(private s3Service: S3Service) {}

  async ngOnInit() {
    await this.testS3Connection();
  }

  async testS3Connection() {
    try {
      this.connectionStatus = 'testing';
      const response = await this.s3Service.listObjects('', 10);

      if (response.Contents) {
        this.objectCount = response.KeyCount || 0;
        this.sampleObjects = response.Contents
          .slice(0, 5)
          .map(obj => obj.Key || '')
          .filter(key => key !== '');
        this.connectionStatus = 'success';
      } else {
        this.connectionStatus = 'success';
        this.objectCount = 0;
      }
    } catch (error: any) {
      this.connectionStatus = 'error';
      this.errorMessage = error.message || 'Unknown error occurred';
      console.error('S3 Connection Error:', error);
    }
  }

  async retryConnection() {
    await this.testS3Connection();
  }
}
