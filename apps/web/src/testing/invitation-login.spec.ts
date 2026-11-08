import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from '@mirhal/auth-page';
import { AuthStore } from '@mirhal/auth';
import { Api, Toasts } from '@mirhal/data-access';
import { Preferences } from '@mirhal/utilities';

describe('invitation sign-in', () => {
  const post = vi.fn();
  const login = vi.fn();
  const success = vi.fn();
  const error = vi.fn();
  const navigate = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    login.mockResolvedValue({ role: 'USER', profile: { onboardingCompletedAt: 'done' } });
    navigate.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ mode: 'login' })),
            snapshot: {
              paramMap: convertToParamMap({ mode: 'login' }),
              queryParamMap: convertToParamMap({ inviteToken: 'invitation-token' }),
              data: {},
            },
          },
        },
        { provide: Router, useValue: { navigate } },
        { provide: AuthStore, useValue: { login } },
        {
          provide: Api,
          useValue: {
            resource: () => ({ data: () => null }),
            get: vi.fn().mockResolvedValue({ valid: true }),
            post,
          },
        },
        { provide: Preferences, useValue: { t: (english: string) => english } },
        { provide: Toasts, useValue: { success, error } },
      ],
    });
  });
  it("preserves invitation context after login without accepting on the recipient's behalf", async () => {
    const page = TestBed.runInInjectionContext(() => new AuthPage());
    page.form.patchValue({ email: 'user@example.test', password: 'long-password-test' });
    await page.submit();
    expect(post).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/friends'], {
      queryParams: { inviteToken: 'invitation-token' },
    });
  });
});
