import { Component, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { LoadingService } from '@lifequest/data-access';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/app';

@Component({ standalone: true, template: '' })
class Destination {}

describe('Admin shared loading experience', () => {
  let isLoading: WritableSignal<boolean>;
  let setNavigating: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isLoading = signal(true);
    setNavigating = vi.fn();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows the shared accessible MIRHAL progress bar', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        {
          provide: LoadingService,
          useValue: {
            isLoading,
            setNavigating,
            showOverlay: signal(false),
            showTopBar: isLoading,
          },
        },
      ],
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const progress = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(progress).not.toBeNull();
    expect(progress.querySelector('.loading-bar')).not.toBeNull();
  });

  it('starts and clears loading state across successful route navigation', async () => {
    let finishNavigation: (value: boolean) => void = () => undefined;
    let notifyNavigationStarted: () => void = () => undefined;
    const navigationStarted = new Promise<void>((resolve) => {
      notifyNavigationStarted = resolve;
    });
    const waitForNavigation: CanActivateFn = () =>
      new Promise<boolean>((resolve) => {
        finishNavigation = resolve;
        notifyNavigationStarted();
      });
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: 'destination', component: Destination, canActivate: [waitForNavigation] },
        ]),
        provideTranslateService({ fallbackLang: 'en' }),
        {
          provide: LoadingService,
          useValue: {
            isLoading,
            setNavigating,
            showOverlay: signal(false),
            showTopBar: isLoading,
          },
        },
      ],
    });
    await TestBed.compileComponents();
    TestBed.createComponent(App).detectChanges();
    const navigation = TestBed.inject(Router).navigateByUrl('/destination');
    await navigationStarted;

    expect(setNavigating).toHaveBeenCalledWith(true);
    finishNavigation(true);
    await navigation;
    expect(setNavigating).toHaveBeenLastCalledWith(false);
  });
});
