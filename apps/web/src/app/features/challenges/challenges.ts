import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from 'primeng/api';
import {
  Api,
  Area,
  Challenge,
  Friend,
  Habit,
  Page,
  Toasts,
} from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import {
  Pagination,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  Progress,
} from '@lifequest/ui';
import { applyServerValidation, FormField } from '@lifequest/forms';
@Component({
  selector: 'lq-challenges',
  imports: [
    TranslatePipe,
    Pagination,
    LocalizedDatePipe,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Icon,
    Progress,
    FormField,
  ],
  templateUrl: './challenges.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChallengesPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(ConfirmationService);
  readonly auth = inject(AuthStore);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<Challenge>>('challenges');
  readonly friends = this.api.resource<Page<Friend>>('friends?status=ACCEPTED&limit=100');
  readonly areas = this.api.resource<Area[]>('life-areas');
  readonly habits = this.api.resource<Page<Habit>>('habits?limit=100');
  readonly acceptedFriends = computed(
    () => this.friends.data()?.items.filter((friend) => friend.status === 'ACCEPTED') ?? [],
  );
  readonly open = signal(false);
  readonly accepting = signal<Challenge | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly invited = signal<string[]>([]);
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    mode: ['CONSISTENCY'],
    scope: ['LIFE'],
    habitId: [''],
    areaId: [''],
    startDate: [''],
    target: [7, Validators.min(1)],
    endDate: ['', Validators.required],
    lowerIsBetter: [false],
  });
  readonly acceptance = this.fb.nonNullable.group({
    habitId: [''],
    shareScore: [true],
    shareProgress: [true],
    shareStreak: [false],
  });
  readonly modes = [
    { id: 'CONSISTENCY', key: 'web.challenges.modes.consistency' },
    { id: 'SCORE', key: 'web.challenges.modes.score' },
    { id: 'IMPROVEMENT', key: 'web.challenges.modes.improvement' },
    { id: 'TARGET', key: 'web.challenges.modes.target' },
    { id: 'STREAK', key: 'web.challenges.modes.streak' },
    { id: 'COOPERATIVE', key: 'web.challenges.modes.cooperative' },
  ];
  readonly shareSettings = [
    { key: 'shareScore', translationKey: 'web.challenges.sharing.score' },
    { key: 'shareProgress', translationKey: 'web.challenges.sharing.progress' },
    { key: 'shareStreak', translationKey: 'web.challenges.sharing.streak' },
  ];
  modeLabel(mode: string) {
    return this.modes.find((item) => item.id === mode)?.key ?? mode;
  }
  create() {
    this.form.reset({
      mode: 'CONSISTENCY',
      scope: 'LIFE',
      target: 7,
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      lowerIsBetter: false,
    });
    this.invited.set([]);
    this.error.set('');
    this.open.set(true);
  }
  toggleFriend(id: string) {
    this.invited.update((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  }
  page(page: number) {
    void this.resource.load(`challenges?page=${page}`);
  }
  async save() {
    if (this.form.invalid || !this.invited().length) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const input = this.form.getRawValue();
      await this.api.post('challenges', {
        ...input,
        scope: input.habitId ? 'HABIT' : input.areaId ? 'AREA' : 'LIFE',
        areaId: input.areaId || null,
        habitId: input.habitId || null,
        startDate: input.startDate
          ? new Date(input.startDate).toISOString()
          : new Date().toISOString(),
        endDate: new Date(input.endDate + 'T23:59:00').toISOString(),
        friendIds: this.invited(),
      });
      this.open.set(false);
      this.toasts.success(this.i18n.t('An invitation to grow.', 'دعوة للنمو.'));
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  invitation(challenge: Challenge) {
    return (
      challenge.participants.some((p) => p.own && p.status === 'INVITED') &&
      !['COMPLETED', 'CANCELLED'].includes(challenge.status)
    );
  }
  showAccept(challenge: Challenge) {
    this.accepting.set(challenge);
    this.acceptance.reset({
      shareScore: this.auth.user()?.profile.shareChallengeScore ?? true,
      shareProgress: true,
      shareStreak: this.auth.user()?.profile.shareStreak ?? false,
      habitId: '',
    });
    this.error.set('');
  }
  async accept() {
    const challenge = this.accepting();
    if (!challenge) return;
    this.saving.set(true);
    try {
      const input = this.acceptance.getRawValue();
      await this.api.post(`challenges/${challenge.id}/accept`, {
        ...input,
        habitId: input.habitId || null,
      });
      this.accepting.set(null);
      this.toasts.success(this.i18n.t('You’re on the journey together.', 'أنتما في الرحلة معاً.'));
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.acceptance, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async action(challenge: Challenge, action: string) {
    try {
      await this.api.post(`challenges/${challenge.id}/actions`, { action });
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    }
  }
  cancel(challenge: Challenge) {
    this.confirm.confirm({
      header: this.i18n.t('Make room for a different plan', 'اصنع مساحة لخطة مختلفة'),
      message: this.i18n.t(
        'Cancel this challenge for everyone? Existing personal progress will remain.',
        'إلغاء هذا التحدي للجميع؟ التقدم الشخصي الحالي سيبقى.',
      ),
      acceptLabel: this.i18n.t('Cancel challenge', 'إلغاء التحدي'),
      rejectLabel: this.i18n.t('Keep going', 'استمرار'),
      accept: () => void this.action(challenge, 'cancel'),
    });
  }
}
