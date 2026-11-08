import { Pagination } from '@mirhal/ui';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from 'primeng/api';
import {
  Api,
  Page,
  Redemption,
  Reward,
  RewardSaving,
  RewardRecommendation,
  Toasts,
  XpSummary,
} from '@mirhal/data-access';
import { LocalizedDatePipe, Preferences } from '@mirhal/utilities';
import { EmptyState, ErrorState, Icon, PageHeader, SectionTitle } from '@mirhal/ui';
import { applyServerValidation, FormField, DiscardChanges, UnsavedForm } from '@mirhal/forms';
@Component({
  selector: 'lq-rewards',
  imports: [
    TranslatePipe,
    Pagination,
    LocalizedDatePipe,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Icon,
    SectionTitle,
    FormField,
    UnsavedForm,
  ],
  templateUrl: './rewards.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RewardsPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(ConfirmationService);
  readonly discard = inject(DiscardChanges);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<Reward>>('rewards');
  readonly xp = this.api.resource<XpSummary>('xp');
  readonly history = this.api.resource<Page<Redemption>>('redemptions');
  readonly mine = this.api.resource<Page<Reward>>('my-rewards');
  readonly savings = this.api.resource<Page<RewardSaving>>('reward-savings');
  readonly recommendations = this.api.resource<RewardRecommendation[]>('reward-recommendations');
  readonly open = signal(false);
  readonly editing = signal<string | null>(null);
  readonly busy = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  private readonly keys = new Map<string, string>();
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    cost: [150, [Validators.required, Validators.min(50)]],
    icon: ['gift'],
    category: ['personal'],
    cooldownDays: [0, [Validators.min(0), Validators.max(365)]],
  });
  rewardTitle(reward: { title: string; titleAr?: string; userId?: string | null }) {
    if (this.i18n.language() === 'en') return reward.title;
    return (
      reward.titleAr ||
      (reward.userId === null
        ? this.i18n.t(
            'Reward name not available in Arabic yet.',
            'اسم المكافأة غير متاح بالعربية بعد.',
          )
        : reward.title)
    );
  }
  rewardDescription(reward: Reward) {
    if (this.i18n.language() === 'en') return reward.description;
    return (
      reward.descriptionAr ||
      (reward.userId === null
        ? this.i18n.t(
            'Reward description not available in Arabic yet.',
            'وصف هذه المكافأة غير متاح بالعربية بعد.',
          )
        : reward.description)
    );
  }
  rewardCategory(reward: { category: string; categoryAr?: string; userId?: string | null }) {
    if (this.i18n.language() === 'en') return reward.category;
    return (
      reward.categoryAr ||
      (reward.userId === null
        ? this.i18n.t('Reward category', 'فئة المكافأة')
        : this.i18n.label(reward.category))
    );
  }
  create() {
    this.editing.set(null);
    this.form.reset({ cost: 150, icon: 'gift', category: 'personal', cooldownDays: 0 });
    this.error.set('');
    this.open.set(true);
  }
  edit(reward: Reward) {
    this.editing.set(reward.id);
    this.form.reset({
      title: reward.title,
      description: reward.description,
      cost: reward.cost,
      icon: reward.icon,
      category: reward.category,
      cooldownDays: reward.cooldownDays,
    });
    this.error.set('');
    this.open.set(true);
  }
  async refreshRewards() {
    await Promise.all([
      this.resource.load(),
      this.mine.load(),
      this.savings.load(),
      this.recommendations.load(),
    ]);
  }
  recommendationReason(item: RewardRecommendation) {
    switch (item.reason) {
      case 'favorite':
        return this.i18n.t('You saved this as a favorite.', 'حفظت هذه ضمن مفضلاتك.');
      case 'enjoyed_category':
        return this.i18n.t('You enjoyed similar rewards before.', 'استمتعت بمكافآت مشابهة من قبل.');
      case 'time_match':
        return this.i18n.t('It suits this time of day.', 'تناسب هذا الوقت من اليوم.');
      case 'discover':
        return this.i18n.t('Something new you might enjoy.', 'شيء جديد قد يعجبك.');
      case 'chosen_category':
        return this.i18n.t(
          'You have chosen similar rewards before.',
          'اخترت مكافآت مشابهة من قبل.',
        );
      case 'another_option':
        return this.i18n.t('Another option to consider.', 'خيار آخر قد يناسبك.');
    }
  }
  async favorite(reward: Reward) {
    try {
      if (reward.favorite) await this.api.delete(`rewards/${reward.id}/favorite`);
      else await this.api.put(`rewards/${reward.id}/favorite`);
      await this.refreshRewards();
    } catch (error) {
      this.toasts.error(error);
    }
  }
  async saveFor(reward: Pick<Reward, 'id' | 'cost'>) {
    try {
      await this.api.put(`rewards/${reward.id}/save`, { targetXp: reward.cost });
      await this.savings.load();
      this.toasts.success(this.i18n.t('Added to your savings goals.', 'أُضيفت إلى أهداف الادخار.'));
    } catch (error) {
      this.toasts.error(error);
    }
  }
  async removeSaving(rewardId: string) {
    try {
      await this.api.delete(`rewards/${rewardId}/save`);
      await this.savings.load();
    } catch (error) {
      this.toasts.error(error);
    }
  }
  async setActive(reward: Reward) {
    try {
      await this.api.patch(`rewards/${reward.id}`, { active: !reward.active });
      await this.refreshRewards();
    } catch (error) {
      this.toasts.error(error);
    }
  }
  async rate(redemption: Redemption, rating: number) {
    try {
      await this.api.put(`redemptions/${redemption.id}/feedback`, { rating });
      await Promise.all([this.history.load(), this.recommendations.load()]);
      this.toasts.success(this.i18n.t('Thanks for sharing.', 'شكراً لمشاركتك.'));
    } catch (error) {
      this.toasts.error(error);
    }
  }
  rateSelected(redemption: Redemption, event: Event) {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.value)
      void this.rate(redemption, Number(target.value));
  }
  page(page: number) {
    void this.resource.load(`rewards?page=${page}`);
  }
  historyPage(page: number) {
    void this.history.load(`redemptions?page=${page}`);
  }
  minePage(page: number) {
    void this.mine.load(`my-rewards?page=${page}`);
  }
  savingsPage(page: number) {
    void this.savings.load(`reward-savings?page=${page}`);
  }
  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      if (this.editing())
        await this.api.patch(`rewards/${this.editing()}`, this.form.getRawValue());
      else await this.api.post('rewards', this.form.getRawValue());
      this.form.markAsPristine();
      this.open.set(false);
      this.toasts.success(
        this.i18n.t('Something good to look forward to.', 'شيء جميل تتطلع إليه.'),
      );
      await this.refreshRewards();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  confirmRedeem(reward: Reward) {
    this.confirm.confirm({
      header: this.i18n.t('You’ve earned a little joy.', 'استحققت قليلاً من الفرح.'),
      message: this.i18n.t(
        `Spend ${reward.cost} XP on ${reward.title}? You can undo this within five minutes.`,
        `استخدم ${reward.cost} نقطة مقابل ${this.rewardTitle(reward)}؟ يمكنك التراجع خلال خمس دقائق.`,
      ),
      acceptLabel: this.i18n.t('Enjoy this reward', 'استمتع بالمكافأة'),
      rejectLabel: this.i18n.t('Not yet', 'ليس الآن'),
      accept: () => void this.redeem(reward),
    });
  }
  async redeem(reward: Reward) {
    if (this.busy()) return;
    this.busy.set(reward.id);
    const key = this.keys.get(reward.id) ?? crypto.randomUUID();
    this.keys.set(reward.id, key);
    try {
      await this.api.post(`rewards/${reward.id}/redeem`, { idempotencyKey: key });
      this.keys.delete(reward.id);
      this.toasts.success(
        this.i18n.t('This one is for you. Enjoy.', 'هذه لك. استمتع.'),
        this.rewardTitle(reward),
      );
      await Promise.all([
        this.xp.load(),
        this.history.load(),
        this.savings.load(),
        this.recommendations.load(),
      ]);
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set('');
    }
  }
  refundable(redemption: Redemption) {
    return !redemption.refundedAt && Date.now() - new Date(redemption.createdAt).getTime() < 300000;
  }
  async refund(id: string) {
    try {
      await this.api.post(`redemptions/${id}/refund`);
      this.toasts.success(this.i18n.t('XP returned to your balance.', 'عادت النقاط إلى رصيدك.'));
      await Promise.all([
        this.xp.load(),
        this.history.load(),
        this.savings.load(),
        this.recommendations.load(),
      ]);
    } catch (error) {
      this.toasts.error(error);
    }
  }
}
