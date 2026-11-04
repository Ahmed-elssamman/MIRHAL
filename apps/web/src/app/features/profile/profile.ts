import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, Profile } from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Avatar, Icon, PageHeader, Skeleton } from '@lifequest/ui';
import { UnsavedForm, applyServerValidation, FormField } from '@lifequest/forms';
@Component({
  selector: 'lq-profile',
  imports: [
    TranslatePipe,
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
      [eyebrow]="'web.features.profile.copy.the_person_behind_the_progress_ef4454d7' | translate"
      [title]="'web.features.profile.copy.a_little_about_you_cfcc7d20' | translate"
      [description]="
        'web.features.profile.copy.update_your_name_avatar_bio_and_time_zone_eab9b0f9' | translate
      "
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
                'web.features.profile.copy.a_work_in_progress_just_like_all_of_us_f0d9ed04'
                | translate
            }}
          </p>
          <span class="badge mt-5 bg-mint text-mint-ink"
            ><lq-icon name="sprout" [size]="13" />{{
              'web.features.profile.copy.growing_since_706a6834' | translate
            }}
            {{ auth.user()?.createdAt | date: 'MMM y' }}</span
          ><a routerLink="/settings" class="btn btn-secondary mt-6 w-full text-xs"
            ><lq-icon name="settings" [size]="15" />{{
              'web.features.profile.copy.preferences_privacy_21fae2fb' | translate
            }}</a
          >
        </section>
        <section class="card p-6 sm:p-8">
          <h2 class="mb-6 text-lg font-semibold">
            {{ 'web.features.profile.copy.your_personal_details_7a564cc8' | translate }}
          </h2>
          <form [formGroup]="form" [lqUnsavedForm]="form" (ngSubmit)="save()">
            <fieldset class="mb-6">
              <legend class="field-label">
                {{ 'web.features.profile.copy.choose_your_landscape_5b0f0826' | translate }}
              </legend>
              <div class="flex flex-wrap gap-3">
                @for (avatar of avatars; track avatar.name) {
                  <label class="relative cursor-pointer"
                    ><input
                      type="radio"
                      class="peer sr-only"
                      formControlName="avatarUrl"
                      [value]="avatar.src"
                      [attr.aria-label]="avatar.labelKey | translate" /><span
                      class="flex rounded-full p-1 ring-brand peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
                      ><lq-avatar
                        [src]="avatar.src"
                        [name]="auth.user()?.profile?.displayName ?? ''"
                        [size]="44" /></span
                  ></label>
                }
              </div>
            </fieldset>
            <lq-field
              id="profile-name"
              [label]="'web.features.profile.copy.display_name_4e167b8c' | translate"
              ><input
                id="profile-name"
                class="field"
                formControlName="displayName"
                autocomplete="name" /></lq-field
            ><lq-field
              id="profile-bio"
              [label]="'web.features.profile.copy.a_little_about_your_journey_9dde2250' | translate"
            >
              <textarea
                id="profile-bio"
                class="field"
                rows="4"
                formControlName="bio"
              ></textarea></lq-field
            ><lq-field
              id="profile-timezone"
              [label]="'web.features.profile.copy.timezone_ceae4742' | translate"
              [hint]="
                'web.features.profile.copy.your_daily_habits_follow_the_time_where_you_are_e3d496d3'
                  | translate
              "
              ><select id="profile-timezone" class="field" formControlName="timezone">
                @for (zone of timezones; track zone) {
                  <option [value]="zone">{{ zone.replaceAll('_', ' ') }}</option>
                }
              </select></lq-field
            >
            @if (saved()) {
              <p role="status" class="mb-4 text-xs text-mint-ink">
                {{ 'web.features.profile.copy.your_profile_is_up_to_date_4d916b2d' | translate }}
              </p>
            }
            @if (error()) {
              <p role="alert" class="mb-4 text-xs text-rose-600">{{ error() }}</p>
            }
            <button class="btn btn-primary" type="submit" [disabled]="saving() || form.invalid">
              {{ 'web.features.profile.copy.save_profile_9bf48ffd' | translate }}
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
    { name: 'Initial', labelKey: 'web.profile.avatars.initial', src: null },
    ...['dawn', 'grove', 'tide', 'bloom', 'summit', 'moon'].map((name) => ({
      name,
      labelKey: 'web.profile.avatars.' + name,
      src: '/avatars/' + name + '.svg',
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
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
