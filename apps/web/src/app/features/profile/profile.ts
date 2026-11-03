import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, errorMessage, Profile } from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Avatar, Icon, PageHeader, Skeleton } from '@lifequest/ui';
import { UnsavedForm, applyServerValidation, FormField } from '@lifequest/forms';
@Component({
  selector: 'lq-profile',
  imports: [
    UnsavedForm,
    Avatar,
    RouterLink,
    LocalizedDatePipe,
    ReactiveFormsModule,
    PageHeader,
    Icon,
    FormField,
    Skeleton,
  ],
  template: `<lq-page-header
      [eyebrow]="i18n.t('THE PERSON BEHIND THE PROGRESS', 'الشخص وراء التقدم')"
      [title]="i18n.t('A little about you.', 'قليل عنك.')"
      [description]="i18n.t('Make this space feel like your own.', 'اجعل هذه المساحة تشبهك.')"
    />
    @if (!auth.user()) {
      <lq-skeleton />
    } @else {
      <div class="grid items-start gap-6 lg:grid-cols-[1fr_1.6fr]">
      <section class="card p-8 text-center">
        <lq-avatar
          [name]="auth.user()?.profile?.displayName ?? ''"
          [src]="auth.user()?.profile?.avatarUrl"
          [size]="96"
        />
        <h2 class="mt-5 text-xl font-semibold">{{ auth.user()?.profile?.displayName }}</h2>
        <p class="mt-2 text-xs text-muted">{{ auth.user()?.email }}</p>
        <p class="mt-5 text-xs leading-7 text-muted">
          {{
            auth.user()?.profile?.bio ||
              i18n.t('A work in progress. Just like all of us.', 'في طور النمو. مثلنا جميعاً.')
          }}
        </p>
        <span class="badge mt-5 bg-mint text-mint-ink"
          ><lq-icon name="sprout" [size]="13" />{{ i18n.t('Growing since', 'تنمو منذ') }}
          {{ auth.user()?.createdAt | date: 'MMM y' }}</span
        ><a routerLink="/settings" class="btn btn-secondary mt-6 w-full text-xs"
          ><lq-icon name="settings" [size]="15" />{{
            i18n.t('Preferences & privacy', 'التفضيلات والخصوصية')
          }}</a
        >
      </section>
      <section class="card p-6 sm:p-8">
        <h2 class="mb-6 text-lg font-semibold">
          {{ i18n.t('Your personal details', 'تفاصيلك الشخصية') }}
        </h2>
        <form [formGroup]="form" [lqUnsavedForm]="form" (ngSubmit)="save()">
          <fieldset class="mb-6">
            <legend class="field-label">{{ i18n.t('Choose your landscape', 'اختر مشهدك') }}</legend>
            <div class="flex flex-wrap gap-3">
              @for (avatar of avatars; track avatar.name) {
                <label class="relative cursor-pointer"
                  ><input
                    type="radio"
                    class="peer sr-only"
                    formControlName="avatarUrl"
                    [value]="avatar.src"
                    [attr.aria-label]="i18n.t(avatar.name, avatar.ar)" /><span
                    class="flex rounded-full p-1 ring-brand peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
                    ><lq-avatar
                      [src]="avatar.src"
                      [name]="auth.user()?.profile?.displayName ?? ''"
                      [size]="44" /></span
                ></label>
              }
            </div>
          </fieldset>
          <lq-field id="profile-name" [label]="i18n.t('Display name', 'الاسم الظاهر')"
            ><input
              id="profile-name"
              class="field"
              formControlName="displayName"
              autocomplete="name" /></lq-field
          ><lq-field
            id="profile-bio"
            [label]="i18n.t('A little about your journey', 'قليل عن رحلتك')"
          >
            <textarea
              id="profile-bio"
              class="field"
              rows="4"
              formControlName="bio"
            ></textarea></lq-field
          ><lq-field
            id="profile-timezone"
            [label]="i18n.t('Timezone', 'المنطقة الزمنية')"
            [hint]="
              i18n.t(
                'Your daily habits follow the time where you are.',
                'عاداتك اليومية تتبع التوقيت حيث أنت.'
              )
            "
            ><select id="profile-timezone" class="field" formControlName="timezone">
              @for (zone of timezones; track zone) {
                <option [value]="zone">{{ zone.replaceAll('_', ' ') }}</option>
              }
            </select></lq-field
          >
          @if (saved()) {
            <p role="status" class="mb-4 text-xs text-mint-ink">
              {{ i18n.t('Your profile is up to date.', 'تم تحديث ملفك.') }}
            </p>
          }
          @if (error()) {
            <p role="alert" class="mb-4 text-xs text-rose-600">{{ error() }}</p>
          }
          <button class="btn btn-primary" type="submit" [disabled]="saving() || form.invalid">
            {{ i18n.t('Save profile', 'حفظ الملف') }}
          </button>
        </form>
      </section>
    </div>
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  readonly auth = inject(AuthStore);
  readonly i18n = inject(Preferences);
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly timezones = [
    ...new Set([
      this.auth.user()?.profile.timezone ?? 'UTC',
      'UTC',
      ...Intl.supportedValuesOf('timeZone'),
    ]),
  ];
  readonly avatars = [
    { name: 'Initial', ar: 'الحرف الأول', src: null },
    ...['dawn', 'grove', 'tide', 'bloom', 'summit', 'moon'].map((name, index) => ({
      name,
      ar: ['الفجر', 'البستان', 'المد', 'الإزهار', 'القمة', 'القمر'][index]!,
      src: `/avatars/${name}.svg`,
    })),
  ];
  readonly form = this.fb.nonNullable.group({
    displayName: [
      this.auth.user()?.profile.displayName ?? '',
      [Validators.required, Validators.minLength(2)],
    ],
    avatarUrl: this.fb.control<string | null>(this.auth.user()?.profile.avatarUrl ?? null),
    bio: [this.auth.user()?.profile.bio ?? ''],
    timezone: [this.auth.user()?.profile.timezone ?? 'Africa/Cairo'],
  });
  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const profile = await this.api.patch<Profile>('profile', this.form.getRawValue());
      const user = this.auth.user();
      if (user) this.auth.setUser({ ...user, profile });
      this.form.markAsPristine();
      this.saved.set(true);
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
