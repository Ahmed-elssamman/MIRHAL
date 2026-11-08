import { sessionInterceptor } from '@mirhal/auth';
import { apiErrorInterceptor, apiLoadingInterceptor } from '@mirhal/data-access';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { Preferences } from '@mirhal/utilities';
import { MirhalTranslationLoader } from '@mirhal/i18n';
import { providePrimeNG } from 'primeng/config';
import { MessageService, ConfirmationService } from 'primeng/api';
import type { ComponentsDesignTokens } from '@primeuix/themes/types';
import base from '@primeuix/themes/aura/base';
import button from '@primeuix/themes/aura/button';
import dialog from '@primeuix/themes/aura/dialog';
import confirmdialog from '@primeuix/themes/aura/confirmdialog';
import toast from '@primeuix/themes/aura/toast';
import drawer from '@primeuix/themes/aura/drawer';
const Aura = {
  ...base,
  components: {
    button,
    dialog,
    confirmdialog,
    toast,
    drawer,
  },
};
import { definePreset } from '@primeuix/themes';
const Mirhal = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eefaf5',
      100: '#cbf1e2',
      200: '#a2e4c8',
      300: '#6be0b5',
      400: '#52d6a7',
      500: '#0e7165',
      600: '#0b5e55',
      700: '#084c45',
      800: '#063b36',
      900: '#032c28',
      950: '#021f1d',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#fffefa',
          50: '#f5f7f4',
          100: '#edf1ec',
          200: '#e6ebe7',
          300: '#dce4de',
          400: '#bfcac2',
          500: '#87958f',
          600: '#5d6c66',
          700: '#43524d',
          800: '#202c29',
          900: '#172321',
          950: '#101716',
        },
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
        text: {
          color: '{surface.800}',
          hoverColor: '{surface.900}',
          mutedColor: '{surface.600}',
          hoverMutedColor: '{surface.700}',
        },
        content: {
          background: '{surface.0}',
          hoverBackground: '{surface.100}',
          borderColor: '{surface.200}',
          color: '{text.color}',
          hoverColor: '{text.hover.color}',
        },
        overlay: {
          select: {
            background: '{surface.0}',
            borderColor: '{surface.200}',
            color: '{text.color}',
          },
          popover: {
            background: '{surface.0}',
            borderColor: '{surface.200}',
            color: '{text.color}',
          },
          modal: { background: '{surface.0}', borderColor: '{surface.200}', color: '{text.color}' },
        },
        formField: {
          background: '{surface.0}',
          disabledBackground: '{surface.100}',
          filledBackground: '{surface.50}',
          filledHoverBackground: '{surface.50}',
          filledFocusBackground: '{surface.50}',
          borderColor: '{surface.300}',
          hoverBorderColor: '{surface.400}',
          focusBorderColor: '{primary.color}',
          invalidBorderColor: '#d89086',
          color: '{surface.800}',
          disabledColor: '{surface.500}',
          placeholderColor: '{surface.600}',
          invalidPlaceholderColor: '#a33b31',
          floatLabelColor: '{surface.600}',
          floatLabelFocusColor: '{primary.600}',
          floatLabelActiveColor: '{surface.600}',
          floatLabelInvalidColor: '#a33b31',
          iconColor: '{surface.500}',
        },
      },
      dark: {
        surface: {
          0: '#f3f8f5',
          50: '#cce0d7',
          100: '#9ab8ac',
          200: '#6e877d',
          300: '#4d6e60',
          400: '#385247',
          500: '#2e433a',
          600: '#2d433b',
          700: '#2d423b',
          800: '#243630',
          900: '#1e2f29',
          950: '#1b2824',
        },
        primary: {
          color: '{primary.400}',
          contrastColor: '#0c261e',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
        text: {
          color: '{surface.50}',
          hoverColor: '{surface.0}',
          mutedColor: '{surface.100}',
          hoverMutedColor: '{surface.50}',
        },
        content: {
          background: '{surface.800}',
          hoverBackground: '{surface.600}',
          borderColor: '{surface.600}',
          color: '{text.color}',
          hoverColor: '{text.hover.color}',
        },
        overlay: {
          select: {
            background: '{surface.800}',
            borderColor: '{surface.600}',
            color: '{text.color}',
          },
          popover: {
            background: '{surface.700}',
            borderColor: '{surface.600}',
            color: '{text.color}',
          },
          modal: {
            background: '{surface.700}',
            borderColor: '{surface.600}',
            color: '{text.color}',
          },
        },
        formField: {
          background: '{surface.900}',
          disabledBackground: '{surface.700}',
          filledBackground: '{surface.800}',
          filledHoverBackground: '{surface.700}',
          filledFocusBackground: '{surface.800}',
          borderColor: '{surface.600}',
          hoverBorderColor: '{surface.500}',
          focusBorderColor: '{primary.color}',
          invalidBorderColor: '#d7867e',
          color: '{surface.50}',
          disabledColor: '{surface.200}',
          placeholderColor: '{surface.200}',
          invalidPlaceholderColor: '#ffb4a9',
          floatLabelColor: '{surface.200}',
          floatLabelFocusColor: '{primary.color}',
          floatLabelActiveColor: '{surface.200}',
          floatLabelInvalidColor: '#ffb4a9',
          iconColor: '{surface.200}',
        },
      },
    },
  },
});
export const sharedConfig = (components: ComponentsDesignTokens = {}): ApplicationConfig => ({
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiErrorInterceptor, apiLoadingInterceptor, sessionInterceptor]),
    ),
    provideTranslateService({
      loader: provideTranslateLoader(MirhalTranslationLoader),
      fallbackLang: 'en',
    }),
    provideAppInitializer(() => {
      const preferences = inject(Preferences);
      return firstValueFrom(inject(TranslateService).use(preferences.language()));
    }),
    providePrimeNG({
      theme: {
        preset: definePreset(Mirhal, { components }),
        options: {
          darkModeSelector: '.dark',
          cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' },
        },
      },
      ripple: false,
    }),
    MessageService,
    ConfirmationService,
  ],
});
