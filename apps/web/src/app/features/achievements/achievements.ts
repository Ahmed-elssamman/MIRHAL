import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Api, Achievement, XpSummary } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { ErrorState, Icon, PageHeader, Progress, ProgressRing, Skeleton } from '@lifequest/ui';
@Component({
  selector: 'lq-achievements',
  imports: [
    TranslatePipe,LocalizedDatePipe, PageHeader, ErrorState, Skeleton, Icon, Progress, ProgressRing],
  template: `
    <lq-page-header
      [eyebrow]="('web.features.achievements.copy.look_how_far_you_have_come_bbecf664' | translate)"
      [title]="('web.features.achievements.copy.every_chapter_has_its_milestones_72f4b73c' | translate)"
      [description]="
        ('web.features.achievements.copy.review_the_achievements_you_have_unlocked_and_the_progress_toward_others_07379df5' | translate)
      "
    />
    @if (xp.data(); as data) {
      <section class="card mb-7 flex flex-wrap items-center gap-6 p-6 sm:p-8">
        <lq-ring [value]="data.level.progress" [size]="110"
          ><span class="block text-[10px] text-muted">{{ ('common.copy.level_7eecc6fd' | translate) }}</span
          ><span class="text-3xl font-semibold">{{ data.level.current.number }}</span></lq-ring
        >
        <div class="min-w-0 flex-1">
          <span class="eyebrow text-brand">{{
            ('web.features.achievements.copy.your_current_chapter_dcdd3da2' | translate)
          }}</span>
          <h2 class="mt-2 text-2xl font-semibold">
            {{ i18n.t(data.level.current.title, data.level.current.titleAr) }}
          </h2>
          <p class="mb-4 mt-2 text-xs text-muted">
            {{ data.earned }} {{ ('web.features.achievements.copy.lifetime_xp_b8221a72' | translate) }} ·
            {{ data.level.remaining }} {{ ('web.features.achievements.copy.xp_to_the_next_chapter_ebf16c73' | translate) }}
          </p>
          <lq-progress [value]="data.level.progress" />
        </div>
      </section>
    }
    @if (resource.loading() && !resource.data()) {
      <lq-skeleton />
    } @else if (resource.error()) {
      <lq-error [message]="resource.error()" (retry)="resource.load()" />
    } @else {
      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        @for (item of resource.data(); track item.id) {
          <article class="card p-6" [class.border-brand/30]="!!item.unlockedAt">
            <div class="mb-5 flex items-center justify-between">
              <span
                class="flex size-14 items-center justify-center rounded-2xl"
                [class]="item.unlockedAt ? 'bg-brand-soft text-brand' : 'bg-canvas text-muted'"
                ><lq-icon [name]="item.icon" [size]="28"
              /></span>
              @if (item.unlockedAt) {
                <span class="badge bg-mint text-mint-ink"
                  ><lq-icon name="check" [size]="12" />{{ ('web.features.achievements.copy.unlocked_d6f1a03c' | translate) }}</span
                >
              } @else {
                <lq-icon name="lock" class="text-muted" [size]="16" />
              }
            </div>
            <h2 class="text-base font-semibold">{{ i18n.t(item.title, item.titleAr) }}</h2>
            <p class="mb-5 mt-2 min-h-12 text-xs leading-6 text-muted">
              {{
                i18n.t(
                  item.description,
                  item.descriptionAr ||
                    i18n.t('Achievement description not available in Arabic yet.', 'وصف هذا الإنجاز غير متاح بالعربية بعد.')
                  )
              }}
            </p>
            <lq-progress [value]="item.unlockedAt ? 100 : (item.progress / item.threshold) * 100" />
            <div class="mt-3 flex justify-between text-[10px] text-muted">
              <span>{{
                item.unlockedAt
                  ? (item.unlockedAt | date: 'MMM d, y')
                  : item.progress + ' / ' + item.threshold
              }}</span
              ><span class="text-brand">+{{ item.xpReward }} XP</span>
            </div>
          </article>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AchievementsPage {
  private readonly api = inject(Api);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Achievement[]>('achievements');
  readonly xp = this.api.resource<XpSummary>('xp');
}
