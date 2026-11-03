import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Preferences } from '@lifequest/utilities';
import { RouterOutlet } from '@angular/router';
import { Overlays } from '../../../../libs/ui/src/overlays';
import { GlobalLoader } from '../../../../libs/ui/src/loader';
@Component({
  selector: 'lq-root',
  imports: [RouterOutlet, Overlays, GlobalLoader],
  template: '<lq-global-loader /><router-outlet />@defer (on idle) { <lq-overlays /> }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly preferences = inject(Preferences);
  private readonly document = inject(DOCUMENT);
  constructor() {
    effect(() => {
      const english = this.preferences.language() === 'en';
      this.document.title = english ? 'MIRHAL | Admin' : 'مِرحال | الإدارة';
      this.document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', english ? 'MIRHAL administration.' : 'لوحة إدارة مِرحال.');
    });
  }
}
