import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { Icon, Logo } from '@lifequest/ui';
import { Preferences } from '@lifequest/utilities';
@Component({
  selector: 'lq-landing',
  imports: [
    TranslatePipe,RouterLink, Icon, Logo],
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  readonly i18n = inject(Preferences);
  readonly pillars = [
    {
      icon: 'target',
      titleKey: 'web.landing.pillars.direction.title',
      textKey: 'web.landing.pillars.direction.text',
    },
    {
      icon: 'sprout',
      titleKey: 'web.landing.pillars.rhythm.title',
      textKey: 'web.landing.pillars.rhythm.text',
    },
    {
      icon: 'users',
      titleKey: 'web.landing.pillars.connection.title',
      textKey: 'web.landing.pillars.connection.text',
    },
  ];
}
