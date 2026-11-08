import { bootstrapApplication } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { isDevMode, mergeApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { App } from './app/app';
import { routes } from './app/app.routes';
import { sharedConfig } from '@mirhal/config';
export const webConfig = mergeApplicationConfig(sharedConfig(), {
  providers: [
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideClientHydration(withEventReplay()),
  ],
});
bootstrapApplication(App, webConfig).catch((error) =>
  console.error(
    'MIRHAL could not start.',
    error instanceof Error ? error.message : 'Unknown startup error',
  ),
);
