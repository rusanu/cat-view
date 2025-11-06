import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { PhotosComponent } from './pages/photos/photos.component';
import { FavouritesComponent } from './pages/favourites/favourites.component';
import { SigninComponent } from './pages/signin/signin.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'signin', component: SigninComponent },
  { path: '', component: PhotosComponent, canActivate: [authGuard] },
  { path: 'favourites', component: FavouritesComponent, canActivate: [authGuard] },
  { path: 'test', component: HomeComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
