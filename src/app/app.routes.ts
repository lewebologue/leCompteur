import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'speed-page',
    loadComponent: () =>
      import('./pages/speed-page/speed-page.component').then((m) => m.SpeedometerPage),
  },
  {
    path: '',
    redirectTo: 'speed-page',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'speedometer',
  },
];
