import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { PhotosComponent } from './pages/photos/photos.component';

export const routes: Routes = [
  { path: '', component: PhotosComponent },
  { path: 'test', component: HomeComponent },
  { path: '**', redirectTo: '' }
];
