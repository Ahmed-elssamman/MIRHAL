import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { Api, Remote } from '@lifequest/data-access';
import { ErrorState, Icon, Logo } from '@lifequest/ui';
import { Preferences } from '@lifequest/utilities';

@Component({
  selector: 'lq-help',
  imports: [TranslatePipe, ReactiveFormsModule, RouterLink, ErrorState, Icon, Logo],
  templateUrl: './help.html',
  styleUrl: './help.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpPage {
  readonly i18n = inject(Preferences);
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  readonly articles = new Remote<
    { id: string; title: string; titleAr: string; body: string; bodyAr: string }[]
  >(this.api, 'help');

  constructor() {
    afterNextRender(() => void this.articles.load());
  }

  readonly activeSlide = signal(0);
  readonly saving = signal(false);
  readonly sent = signal(false);
  readonly submitError = signal(false);
  readonly needsSignIn = signal(false);
  private touchStartX = 0;

  private readonly firstSlide = { icon: 'sun', visual: 'intention' };
  readonly slides = [
    this.firstSlide,
    { icon: 'target', visual: 'goal' },
    { icon: 'tasks', visual: 'steps' },
    { icon: 'zap', visual: 'action' },
    { icon: 'chart', visual: 'progress' },
    { icon: 'sprout', visual: 'growth' },
  ];

  readonly currentSlide = computed(() => this.slides[this.activeSlide()] ?? this.firstSlide);
  readonly progress = computed(() => `${((this.activeSlide() + 1) / this.slides.length) * 100}%`);
  readonly categories = [
    { id: 'FEATURE', icon: 'sparkles', title: 'idea.title', description: 'idea.description' },
    { id: 'UX', icon: 'activity', title: 'usability.title', description: 'usability.description' },
    { id: 'BUG', icon: 'alert', title: 'problem.title', description: 'problem.description' },
    {
      id: 'SUGGESTION',
      icon: 'message',
      title: 'general.title',
      description: 'general.description',
    },
    { id: 'OTHER', icon: 'heart', title: 'positive.title', description: 'positive.description' },
  ];

  readonly feedbackForm = this.fb.nonNullable.group({
    category: ['SUGGESTION', Validators.required],
    title: ['', [Validators.required, Validators.pattern(/^(?=(?:[\s\S]*\S){2})[\s\S]{2,100}$/)]],
    description: [
      '',
      [Validators.required, Validators.pattern(/^(?=(?:[\s\S]*\S){10})[\s\S]{10,2000}$/)],
    ],
  });

  readonly faqs = ['tracker', 'missedDay', 'privacy', 'journeyScore'];

  next() {
    this.activeSlide.update((index) => Math.min(index + 1, this.slides.length - 1));
  }

  previous() {
    this.activeSlide.update((index) => Math.max(index - 1, 0));
  }

  select(index: number) {
    this.activeSlide.set(index);
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0]?.clientX ?? 0;
  }

  onTouchEnd(event: TouchEvent) {
    const delta = (event.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
    if (Math.abs(delta) < 45) return;
    const forward = this.i18n.rtl() ? delta < 0 : delta > 0;
    if (forward) this.next();
    else this.previous();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const target = event.target;
    if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      return;
    if (event.key === 'ArrowRight') {
      if (this.i18n.rtl()) this.previous();
      else this.next();
    }
    if (event.key === 'ArrowLeft') {
      if (this.i18n.rtl()) this.next();
      else this.previous();
    }
  }

  async submitFeedback() {
    if (this.saving()) return;
    if (this.feedbackForm.invalid) {
      this.feedbackForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.sent.set(false);
    this.submitError.set(false);
    this.needsSignIn.set(false);
    try {
      await this.api.post('feedback', this.feedbackForm.getRawValue());
      this.sent.set(true);
      this.feedbackForm.reset({ category: 'SUGGESTION', title: '', description: '' });
    } catch (error) {
      this.submitError.set(true);
      this.needsSignIn.set(error instanceof HttpErrorResponse && [401, 403].includes(error.status));
    } finally {
      this.saving.set(false);
    }
  }
}
