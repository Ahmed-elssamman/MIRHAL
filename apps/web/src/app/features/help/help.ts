import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Api, Remote } from '@lifequest/data-access';
import { RouterLink } from '@angular/router';
import { ErrorState, Icon, Logo, Skeleton } from '@lifequest/ui';
import { Preferences } from '@lifequest/utilities';
@Component({
  selector: 'lq-help',
  imports: [
    TranslatePipe,RouterLink, ErrorState, Icon, Logo, Skeleton],
  templateUrl: './help.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpPage {
  readonly i18n = inject(Preferences);
  readonly articles = new Remote<
    { id: string; title: string; titleAr: string; body: string; bodyAr: string }[]
  >(inject(Api), 'help');
  constructor() {
    afterNextRender(() => {
      void this.articles.load();
    });
  }
  readonly selected = signal(0);
  readonly beginner = signal(true);
  readonly steps = [
        {
      titleKey: 'web.help.steps.step01.title',
      textKey: 'web.help.steps.step01.text',
      exampleKey: 'web.help.steps.step01.example',
      labelKey: 'web.help.steps.step01.label',
      icon: 'target',
      link: '/goals',
    },
        {
      titleKey: 'web.help.steps.step02.title',
      textKey: 'web.help.steps.step02.text',
      exampleKey: 'web.help.steps.step02.example',
      labelKey: 'web.help.steps.step02.label',
      icon: 'folder',
      link: '/projects',
    },
        {
      titleKey: 'web.help.steps.step03.title',
      textKey: 'web.help.steps.step03.text',
      exampleKey: 'web.help.steps.step03.example',
      labelKey: 'web.help.steps.step03.label',
      icon: 'tasks',
      link: '/tasks',
    },
        {
      titleKey: 'web.help.steps.step04.title',
      textKey: 'web.help.steps.step04.text',
      exampleKey: 'web.help.steps.step04.example',
      labelKey: 'web.help.steps.step04.label',
      icon: 'sprout',
      link: '/habits',
    },
        {
      titleKey: 'web.help.steps.step05.title',
      textKey: 'web.help.steps.step05.text',
      exampleKey: 'web.help.steps.step05.example',
      labelKey: 'web.help.steps.step05.label',
      icon: 'sun',
      link: '/today',
    },
        {
      titleKey: 'web.help.steps.step06.title',
      textKey: 'web.help.steps.step06.text',
      exampleKey: 'web.help.steps.step06.example',
      labelKey: 'web.help.steps.step06.label',
      icon: 'flag',
      link: '/quests',
    },
        {
      titleKey: 'web.help.steps.step07.title',
      textKey: 'web.help.steps.step07.text',
      exampleKey: 'web.help.steps.step07.example',
      labelKey: 'web.help.steps.step07.label',
      icon: 'zap',
      link: '/achievements',
    },
        {
      titleKey: 'web.help.steps.step08.title',
      textKey: 'web.help.steps.step08.text',
      exampleKey: 'web.help.steps.step08.example',
      labelKey: 'web.help.steps.step08.label',
      icon: 'award',
      link: '/achievements',
    },
        {
      titleKey: 'web.help.steps.step09.title',
      textKey: 'web.help.steps.step09.text',
      exampleKey: 'web.help.steps.step09.example',
      labelKey: 'web.help.steps.step09.label',
      icon: 'award',
      link: '/achievements',
    },
        {
      titleKey: 'web.help.steps.step10.title',
      textKey: 'web.help.steps.step10.text',
      exampleKey: 'web.help.steps.step10.example',
      labelKey: 'web.help.steps.step10.label',
      icon: 'gift',
      link: '/rewards',
    },
        {
      titleKey: 'web.help.steps.step11.title',
      textKey: 'web.help.steps.step11.text',
      exampleKey: 'web.help.steps.step11.example',
      labelKey: 'web.help.steps.step11.label',
      icon: 'users',
      link: '/challenges',
    },
        {
      titleKey: 'web.help.steps.step12.title',
      textKey: 'web.help.steps.step12.text',
      exampleKey: 'web.help.steps.step12.example',
      labelKey: 'web.help.steps.step12.label',
      icon: 'map',
      link: '/journey',
    },
        {
      titleKey: 'web.help.steps.step13.title',
      textKey: 'web.help.steps.step13.text',
      exampleKey: 'web.help.steps.step13.example',
      labelKey: 'web.help.steps.step13.label',
      icon: 'flask',
      link: '/habit-lab',
    },
        {
      titleKey: 'web.help.steps.step14.title',
      textKey: 'web.help.steps.step14.text',
      exampleKey: 'web.help.steps.step14.example',
      labelKey: 'web.help.steps.step14.label',
      icon: 'gift',
      link: '/rewards',
    },
        {
      titleKey: 'web.help.steps.step15.title',
      textKey: 'web.help.steps.step15.text',
      exampleKey: 'web.help.steps.step15.example',
      labelKey: 'web.help.steps.step15.label',
      icon: 'shield',
      link: '/settings',
    },
  ];
  readonly current = computed(() => this.steps[this.selected()]!);
  readonly visible = computed(() =>
    this.beginner() ? this.steps.filter((_, i) => [0, 3, 4, 12].includes(i)) : this.steps,
  );
  toggleBeginner() {
    this.beginner.update((value) => !value);
    if (!this.visible().includes(this.current())) this.selected.set(0);
  }
  readonly connections = [
    { key: 'web.help.connections.goal', step: 0 },
    { key: 'web.help.connections.project', step: 1 },
    { key: 'web.help.connections.task', step: 2 },
    { key: 'web.help.connections.habit', step: 3 },
    { key: 'web.help.connections.checkIn', step: 4 },
    { key: 'web.help.connections.quest', step: 5 },
    { key: 'web.help.connections.xp', step: 6 },
    { key: 'web.help.connections.level', step: 7 },
    { key: 'web.help.connections.achievement', step: 8 },
    { key: 'web.help.connections.reward', step: 9 },
    { key: 'web.help.connections.challenge', step: 10 },
    { key: 'web.help.connections.monthlyReview', step: 11 },
  ];
  readonly todayCards = [
    { number: '01', titleKey: 'web.help.todayCards.habit.title', textKey: 'web.help.todayCards.habit.text' },
    { number: '02', titleKey: 'web.help.todayCards.task.title', textKey: 'web.help.todayCards.task.text' },
    { number: '03', titleKey: 'web.help.todayCards.reflection.title', textKey: 'web.help.todayCards.reflection.text' },
  ];
  readonly faqs = [
    {
      q: 'Is this just a habit tracker?',
      qa: 'هل هو مجرد متتبع عادات؟',
      a: 'MIRHAL connects outcomes, real work, repeated behavior, reflection, and recovery. Habits are one part of a complete personal operating system.',
      aa: 'مِرحال تربط النتائج والعمل الحقيقي والسلوك المتكرر والتأمل والتعافي. العادات جزء من نظام شخصي متكامل.',
    },
    {
      q: 'What happens if I miss a day?',
      qa: 'ماذا يحدث إذا فاتني يوم؟',
      a: 'Nothing is taken away. Notice what happened, use your minimum action, and try again. Your past progress is still yours.',
      aa: 'لا يُسلب منك شيء. لاحظ ما حدث، واستخدم خطوتك الصغيرة، وحاول مجدداً. تقدمك السابق يظل لك.',
    },
    {
      q: 'Can friends see my journal or habit counts?',
      qa: 'هل يرى الأصدقاء يومياتي أو تفاصيل عاداتي؟',
      a: 'No. Your journal, mood, exact behavioral counts, and private notes stay private. Challenge sharing is limited to the progress, score, or streak you choose.',
      aa: 'لا. يومياتك ومزاجك وأعدادك الدقيقة وملاحظاتك تبقى خاصة. مشاركة التحدي تقتصر على التقدم أو النقاط أو الاستمرارية التي تختارها.',
    },
    {
      q: 'How is my journey score calculated?',
      qa: 'كيف تُحسب درجة رحلتي؟',
      a: 'Habits contribute 30%, quests 20%, goals 15%, check-ins 15%, projects 10%, and recovery 10%. Your Insights page shows every contribution.',
      aa: 'العادات 30٪، المهام الأسبوعية 20٪، الأهداف 15٪، التأملات 15٪، المشروعات 10٪، والتعافي 10٪. صفحة الرؤى توضح كل مساهمة.',
    },
  ];
  choose(step: (typeof this.steps)[number]) {
    this.selected.set(this.steps.indexOf(step));
  }
}
