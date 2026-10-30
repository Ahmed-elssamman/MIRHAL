import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationOverlay } from '../app/features/notifications/notification-overlay';

const notification = { id: 'n1', title: 'Notice', body: 'Details', type: 'FRIEND_REQUEST', href: null, readAt: null, createdAt: '2026-10-30T00:00:00Z' };
describe('notification overlay', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), MessageService] }));
  it('marks an unlinked item read without navigating', async () => {
    const fixture = TestBed.createComponent(NotificationOverlay);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/notifications?limit=6').flush({ items: [notification], total: 1, page: 1, limit: 6 });
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const pending = page.openItem(notification);
    void page.openItem(notification);
    http.expectOne('/api/notifications/n1/read').flush({ success: true });
    await pending;
    expect(page.unreadCount()).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
    http.verify();
  });
  it('closes and navigates for a linked item', async () => {
    const fixture = TestBed.createComponent(NotificationOverlay);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/notifications?limit=6').flush({ items: [], total: 0, page: 1, limit: 6 });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const close = vi.fn();
    page.close.subscribe(close);
    await page.openItem({ ...notification, href: '/friends', readAt: '2026-10-30T00:00:00Z' });
    expect(close).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/friends');
    http.verify();
  });
  it('prevents duplicate mark-all requests and updates the visible list', async () => {
    const fixture = TestBed.createComponent(NotificationOverlay);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/notifications?limit=6').flush({ items: [notification], total: 1, page: 1, limit: 6 });
    await fixture.whenStable();
    const pending = page.readAll();
    void page.readAll();
    http.expectOne('/api/notifications/read-all').flush({ success: true });
    await pending;
    expect(page.unreadCount()).toBe(0);
    expect(page.readingAll()).toBe(false);
    http.verify();
  });
});
