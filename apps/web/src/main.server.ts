import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { App } from './app/app';
import { routes } from './app/app.routes';
import { sharedConfig } from '@lifequest/config';
export default (context: BootstrapContext) =>
  bootstrapApplication(
    App,
    mergeApplicationConfig(sharedConfig(), {
      providers: [
        provideRouter(routes),
        provideClientHydration(withEventReplay()),
        provideServerRendering(
          withRoutes([
            { path: '', renderMode: RenderMode.Prerender },
            { path: 'help', renderMode: RenderMode.Prerender },
            { path: '**', renderMode: RenderMode.Client },
          ]),
        ),
      ],
    }),
    context,
  );
