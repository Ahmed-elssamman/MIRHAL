import { sessionInterceptor } from '../../auth/src/session-interceptor';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
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
const LifeQuest = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e4f3ed',
      100: '#c9e8dc',
      200: '#a8d9c8',
      300: '#7ec7b0',
      400: '#4eab91',
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
          0: '#edf4f0',
          50: '#c4d2cb',
          100: '#a5b8af',
          200: '#75877f',
          300: '#4b5c55',
          400: '#35443f',
          500: '#293833',
          600: '#25332f',
          700: '#222e2b',
          800: '#192321',
          900: '#17211f',
          950: '#111a19',
        },
        primary: {
          color: '{primary.400}',
          contrastColor: '#15332d',
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
          hoverBackground: '{surface.700}',
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
    provideHttpClient(withFetch(), withInterceptors([sessionInterceptor])),
    providePrimeNG({
      theme: {
        preset: definePreset(LifeQuest, { components }),
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
