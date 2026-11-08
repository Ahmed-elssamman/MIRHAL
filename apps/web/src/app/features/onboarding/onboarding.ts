import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Api, Area, User } from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { Preferences } from '@lifequest/utilities';
import { ErrorState, Icon, Logo, Progress } from '@lifequest/ui';
import { applyServerValidation, FormField } from '@lifequest/forms';
@Component({
  selector: 'lq-onboarding',
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    ErrorState,
    Icon,
    Logo,
    Progress,
    FormField,
  ],
  templateUrl: './onboarding.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(Preferences);
  readonly areas = this.api.resource<Area[]>('life-areas');
  readonly selected = signal<string[]>([]);
  readonly step = signal(0);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    goal: [''],
    habit: [''],
    preferredRoutine: ['morning'],
    profileVisibility: ['PRIVATE'],
  });
  readonly steps = [
    {
      titleKey: 'web.onboarding.steps.area.title',
      textKey: 'web.onboarding.steps.area.text',
      icon: 'heart',
    },
    {
      titleKey: 'web.onboarding.steps.priority.title',
      textKey: 'web.onboarding.steps.priority.text',
      icon: 'target',
    },
    {
      titleKey: 'web.onboarding.steps.schedule.title',
      textKey: 'web.onboarding.steps.schedule.text',
      icon: 'sun',
    },
  ];
  readonly previousStep = (step: number) => step - 1;
  toggle(id: string) {
    this.selected.update((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  skipDetails() {
    this.form.patchValue({ goal: '', habit: '' });
    this.step.set(2);
  }
  async next() {
    if (this.busy() || !this.selected().length) return;
    this.error.set('');
    if (this.step() < this.steps.length - 1) {
      this.step.update((step) => step + 1);
      return;
    }
    this.busy.set(true);
    try {
      const values = this.form.getRawValue();
      await this.api.post('onboarding', {
        areaIds: this.selected(),
        ...values,
        goal: values.goal.trim() || undefined,
        habit: values.habit.trim() || undefined,
      });
      const user = await this.api.get<User>('auth/me');
      this.auth.setUser(user);
      const inviteToken = this.route.snapshot.queryParamMap.get('inviteToken');
      await this.router.navigate(inviteToken ? ['/friends'] : ['/today'], {
        ...(inviteToken ? { queryParams: { inviteToken } } : {}),
      });
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
