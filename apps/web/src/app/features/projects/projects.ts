import { Milestones } from '../goals/milestones';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Api, Goal, Page, Project, Toasts } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import {
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  Pagination,
  Progress,
} from '@lifequest/ui';
import { applyServerValidation, FormField, DiscardChanges, UnsavedForm } from '@lifequest/forms';
@Component({
  selector: 'lq-projects',
  imports: [
    TranslatePipe,
    Milestones,
    RouterLink,
    LocalizedDatePipe,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Icon,
    Progress,
    Pagination,
    FormField,
    UnsavedForm,
  ],
  templateUrl: './projects.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  readonly discard = inject(DiscardChanges);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<Project>>('projects');
  readonly goals = this.api.resource<Page<Goal>>('goals?limit=100');
  readonly open = signal(false);
  readonly editing = signal<Project | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    goalId: [''],
    deadline: [''],
    priority: ['MEDIUM'],
    notes: [''],
    startDate: [''],
  });
  create() {
    this.editing.set(null);
    this.form.reset({ priority: 'MEDIUM' });
    this.error.set('');
    this.open.set(true);
  }
  edit(project: Project) {
    this.editing.set(project);
    this.form.reset({
      ...project,
      goalId: project.goalId ?? '',
      startDate: project.startDate?.slice(0, 10) ?? '',
      deadline: project.deadline?.slice(0, 10) ?? '',
    });
    this.open.set(true);
  }
  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const values = this.form.getRawValue();
    const input = {
      ...values,
      startDate: values.startDate || null,
      goalId: values.goalId || null,
      deadline: values.deadline || null,
    };
    try {
      const editing = this.editing();
      if (editing) await this.api.patch(`projects/${editing.id}`, input);
      else await this.api.post('projects', input);
      this.form.markAsPristine();
      this.open.set(false);
      this.toasts.success(this.i18n.t('Your next body of work is ready.', 'مشروعك القادم جاهز.'));
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async status(project: Project, status: string) {
    try {
      await this.api.patch(`projects/${project.id}`, { status });
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    }
  }
  page(page: number) {
    void this.resource.load(`projects?page=${page}`);
  }
}
