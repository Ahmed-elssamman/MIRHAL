import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Shell } from '../app/layout/shell';
import { Preferences } from '@lifequest/utilities';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Configurable Sidebar Navigation', () => {
  beforeEach(() => {
    localStorage.removeItem('lq-show-additional-nav');
    if (!window.matchMedia) {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'today', component: Shell },
          { path: 'tasks', component: Shell },
          { path: 'habits', component: Shell },
          { path: 'journey', component: Shell },
          { path: 'friends', component: Shell },
          { path: 'goals', component: Shell },
          { path: 'projects', component: Shell },
          { path: 'dashboard', component: Shell },
        ]),
        MessageService,
      ],
    });
  });

  it('defaults showAdditionalNavigation strictly to false', () => {
    const prefs = TestBed.inject(Preferences);
    expect(prefs.showAdditionalNavigation()).toBe(false);
  });

  it('renders primary navigation and hides additional navigation when showAdditionalNavigation is false', () => {
    const fixture = TestBed.createComponent(Shell);
    const prefs = TestBed.inject(Preferences);
    prefs.setLanguage('en');
    prefs.setShowAdditionalNavigation(false);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    // Primary items must be visible
    expect(text).toContain('Today');
    expect(text).toContain('Tasks');
    expect(text).toContain('Habits');
    expect(text).toContain('Friends');

    // Additional items must NOT be rendered in the sidebar
    expect(text).not.toContain('Goals');
    expect(text).not.toContain('Projects');
    expect(text).not.toContain('Habit Lab');
  });

  it('shows additional navigation items when showAdditionalNavigation is toggled to true', () => {
    const fixture = TestBed.createComponent(Shell);
    const component = fixture.componentInstance;
    const prefs = TestBed.inject(Preferences);

    prefs.setLanguage('en');
    prefs.setShowAdditionalNavigation(true);
    component.moreOpen.set(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    // Primary items still visible
    expect(text).toContain('Today');
    expect(text).toContain('Tasks');
    expect(text).toContain('Habits');
    expect(text).toContain('Friends');

    // Additional items are now rendered
    expect(text).toContain('Goals');
    expect(text).toContain('Projects');
    expect(text).toContain('Habit Lab');
  });

  it('renders correctly in Arabic with appropriate localized terms', () => {
    const fixture = TestBed.createComponent(Shell);
    const component = fixture.componentInstance;
    const prefs = TestBed.inject(Preferences);

    prefs.setLanguage('ar');
    prefs.setShowAdditionalNavigation(false);
    fixture.detectChanges();

    let text = fixture.nativeElement.textContent;
    expect(text).toContain('اليوم');
    expect(text).toContain('المهام');
    expect(text).toContain('العادات');
    expect(text).toContain('الأصدقاء');
    expect(text).not.toContain('الأهداف');

    prefs.setShowAdditionalNavigation(true);
    component.moreOpen.set(true);
    fixture.detectChanges();

    text = fixture.nativeElement.textContent;
    expect(text).toContain('الأهداف');
    expect(text).toContain('المشروعات');
    expect(text).toContain('مختبر العادات');
  });

  it('persists preference to localStorage and reloads it on initialization', () => {
    const prefs = TestBed.inject(Preferences);
    prefs.setShowAdditionalNavigation(true);
    expect(localStorage.getItem('lq-show-additional-nav')).toBe('true');

    prefs.setShowAdditionalNavigation(false);
    expect(localStorage.getItem('lq-show-additional-nav')).toBe('false');
  });

  it('supports direct route access and highlights active route', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Shell);
    const prefs = TestBed.inject(Preferences);
    prefs.setShowAdditionalNavigation(true);

    await router.navigateByUrl('/goals');
    fixture.detectChanges();
    await fixture.whenStable();

    // Verify moreOpen auto-expanded when visiting an additional page
    expect(fixture.componentInstance.moreOpen()).toBe(true);
  });
});
