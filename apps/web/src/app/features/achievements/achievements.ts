import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Api, Achievement, XpSummary } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { ErrorState, Icon, PageHeader, Progress, ProgressRing, Skeleton } from '@lifequest/ui';
@Component({
  selector: 'lq-achievements',
  imports: [LocalizedDatePipe, PageHeader, ErrorState, Skeleton, Icon, Progress, ProgressRing],
  template: `
    <lq-page-header
      [eyebrow]="i18n.t('LOOK HOW FAR YOU HAVE COME', 'انظر كم تقدمت')"
      [title]="i18n.t('Every chapter has its milestones.', 'لكل فصل محطاته.')"
      [description]="
        i18n.t(
        'Review the achievements you have unlocked and the progress toward others.',
        'راجع الإنجازات التي حققتها وتقدمك نحو الإنجازات الأخرى.'
        )
      "
    />
    @if (xp.data(); as data) {
      <section class="card mb-7 flex flex-wrap items-center gap-6 p-6 sm:p-8">
        <lq-ring [value]="data.level.progress" [size]="110"
          ><span class="block text-[10px] text-muted">{{ i18n.t('LEVEL', 'مستوى') }}</span
          ><span class="text-3xl font-semibold">{{ data.level.current.number }}</span></lq-ring
        >
        <div class="min-w-0 flex-1">
          <span class="eyebrow text-brand">{{
            i18n.t('YOUR CURRENT CHAPTER', 'فصلك الحالي')
          }}</span>
          <h2 class="mt-2 text-2xl font-semibold">
            {{ i18n.t(data.level.current.title, data.level.current.titleAr) }}
          </h2>
          <p class="mb-4 mt-2 text-xs text-muted">
            {{ data.earned }} {{ i18n.t('lifetime XP', 'نقطة عبر رحلتك') }} ·
            {{ data.level.remaining }} {{ i18n.t('XP to the next chapter', 'نقطة للفصل التالي') }}
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
                  ><lq-icon name="check" [size]="12" />{{ i18n.t('Unlocked', 'مكتسب') }}</span
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
                  item.descriptionAr || 'وصف هذا الإنجاز غير متاح بالعربية بعد.'
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
