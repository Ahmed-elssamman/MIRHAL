import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TodayPage } from '../app/features/today/today';
import { TasksPage } from '../app/features/tasks/tasks';
import { Task } from '@lifequest/data-access';
import { beforeEach, describe, expect, it } from 'vitest';

const createTask = (id: string, title: string, status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' = 'ACTIVE'): Task => ({
  id,
  title,
  description: '',
  status,
  priority: 'MEDIUM',
  labels: [],
  startDate: null,
  parentId: null,
  parent: null,
  projectId: null,
  goalId: null,
  dueDate: null,
  estimatedMinutes: null,
  project: null,
});

describe('Task Performance & Optimistic UI Updates', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        ConfirmationService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('TodayPage: immediately removes completed task optimistically (<50ms) and reconciles on success without refetching', async () => {
    const fixture = TestBed.createComponent(TodayPage);
    const component = fixture.componentInstance;

    // Flush initial resources (habits, tasks, check-ins)
    http.expectOne('/api/habits?today=true&limit=10').flush({ items: [], total: 0, date: '2026-10-29', completedCount: 0 });
    http.expectOne('/api/tasks?today=true&limit=8').flush({
      items: [createTask('t-1', 'Morning routine'), createTask('t-2', 'Review notes')],
      total: 2,
      page: 1,
      limit: 8,
    });
    http.expectOne('/api/check-ins').flush([]);
    await fixture.whenStable();

    expect(component.todayTasks().length).toBe(2);

    // Act: Mark t-1 as complete
    const promise = component.completeTask('t-1');

    // Assert: Immediate visual feedback (< 50ms)
    expect(component.todayTasks().length).toBe(1);
    expect(component.todayTasks()[0]!.id).toBe('t-2');
    expect(component.pendingTaskIds().has('t-1')).toBe(true);

    // Duplicate submission prevention: Second click on same task is a no-op
    void component.completeTask('t-1');

    // Assert: Exactly 1 HTTP request is in-flight
    const req = http.expectOne('/api/tasks/t-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'COMPLETED' });

    // Respond with success
    req.flush({ awarded: 10 });
    await promise;

    // Assert: Task remains completed, lock released, and NO second GET request was fired
    expect(component.todayTasks().length).toBe(1);
    expect(component.pendingTaskIds().has('t-1')).toBe(false);
    http.expectNone('/api/tasks?today=true&limit=8');
    http.verify();
  });

  it('TodayPage: rolls back optimistic completion when API fails', async () => {
    const fixture = TestBed.createComponent(TodayPage);
    const component = fixture.componentInstance;

    http.expectOne('/api/habits?today=true&limit=10').flush({ items: [], total: 0, date: '2026-10-29', completedCount: 0 });
    http.expectOne('/api/tasks?today=true&limit=8').flush({
      items: [createTask('t-1', 'Save world')],
      total: 1,
      page: 1,
      limit: 8,
    });
    http.expectOne('/api/check-ins').flush([]);
    await fixture.whenStable();

    expect(component.todayTasks().length).toBe(1);

    // Complete task
    const promise = component.completeTask('t-1');

    // Immediately removed optimistically
    expect(component.todayTasks().length).toBe(0);

    // Simulate API error (500)
    const req = http.expectOne('/api/tasks/t-1');
    req.flush({ message: 'Internal server error' }, { status: 500, statusText: 'Server Error' });
    await promise;

    // Assert: Rollback occurred, task is back
    expect(component.todayTasks().length).toBe(1);
    expect(component.todayTasks()[0]!.id).toBe('t-1');
    expect(component.pendingTaskIds().has('t-1')).toBe(false);
  });

  it('TodayPage: supports rapid successive completions across multiple tasks', async () => {
    const fixture = TestBed.createComponent(TodayPage);
    const component = fixture.componentInstance;

    http.expectOne('/api/habits?today=true&limit=10').flush({ items: [], total: 0, date: '2026-10-29', completedCount: 0 });
    http.expectOne('/api/tasks?today=true&limit=8').flush({
      items: [createTask('t-1', 'Task 1'), createTask('t-2', 'Task 2'), createTask('t-3', 'Task 3')],
      total: 3,
      page: 1,
      limit: 8,
    });
    http.expectOne('/api/check-ins').flush([]);
    await fixture.whenStable();

    // Click task 1, then task 2 in rapid succession
    const p1 = component.completeTask('t-1');
    const p2 = component.completeTask('t-2');

    // Both should be optimistically removed immediately
    expect(component.todayTasks().length).toBe(1);
    expect(component.todayTasks()[0]!.id).toBe('t-3');
    expect(component.pendingTaskIds().has('t-1')).toBe(true);
    expect(component.pendingTaskIds().has('t-2')).toBe(true);

    const req1 = http.expectOne('/api/tasks/t-1');
    const req2 = http.expectOne('/api/tasks/t-2');

    req1.flush({ awarded: 10 });
    req2.flush({ awarded: 10 });

    await Promise.all([p1, p2]);

    expect(component.todayTasks().length).toBe(1);
    expect(component.pendingTaskIds().size).toBe(0);
  });

  it('TasksPage: optimistically toggles task status, supports undo, and rolls back on error', async () => {
    const fixture = TestBed.createComponent(TasksPage);
    const component = fixture.componentInstance;

    http.expectOne('/api/tasks').flush({
      items: [createTask('task-a', 'Deep work', 'ACTIVE')],
      total: 1,
      page: 1,
      limit: 20,
    });
    http.expectOne('/api/goals?limit=100').flush({ items: [] });
    http.expectOne('/api/projects?limit=100').flush({ items: [] });
    await fixture.whenStable();

    const task = component.visible()[0]!;
    expect(task.status).toBe('ACTIVE');

    // 1. Toggle to COMPLETED
    const p1 = component.toggle(task);
    // Optimistic check: status is immediately COMPLETED
    expect(component.visible()[0]!.status).toBe('COMPLETED');
    expect(component.pendingTaskIds().has('task-a')).toBe(true);

    const req1 = http.expectOne('/api/tasks/task-a');
    expect(req1.request.body).toEqual({ status: 'COMPLETED' });
    req1.flush({ awarded: 10 });
    await p1;

    expect(component.visible()[0]!.status).toBe('COMPLETED');
    expect(component.pendingTaskIds().has('task-a')).toBe(false);

    // 2. Undo: Toggle back to ACTIVE
    const completedTask = component.visible()[0]!;
    const p2 = component.toggle(completedTask);
    expect(component.visible()[0]!.status).toBe('ACTIVE');

    const req2 = http.expectOne('/api/tasks/task-a');
    expect(req2.request.body).toEqual({ status: 'ACTIVE' });
    req2.flush({ awarded: 0 });
    await p2;

    expect(component.visible()[0]!.status).toBe('ACTIVE');

    // 3. Rollback on failure
    const activeTask = component.visible()[0]!;
    const p3 = component.toggle(activeTask);
    expect(component.visible()[0]!.status).toBe('COMPLETED'); // optimistically marked completed

    const req3 = http.expectOne('/api/tasks/task-a');
    req3.flush({ message: 'Network error' }, { status: 503, statusText: 'Service Unavailable' });
    await p3;

    // Restored to ACTIVE on error
    expect(component.visible()[0]!.status).toBe('ACTIVE');
    expect(component.pendingTaskIds().has('task-a')).toBe(false);
  });
});
