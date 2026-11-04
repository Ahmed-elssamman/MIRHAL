import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { Database } from '../../apps/api/src/common/database';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';
import { hashToken } from '../../apps/api/src/auth/auth.guard';

describe('registration invitation verification', () => {
  it('binds the invitation during registration without consuming it or creating a friendship', async () => {
    const tx = {
      user: { create: vi.fn().mockResolvedValue({ id: 'recipient' }) },
      invitation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      session: { create: vi.fn().mockResolvedValue({}) },
      friendship: { create: vi.fn() },
    };
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn().mockImplementation((fn) => fn(tx)),
      atomic: vi.fn().mockImplementation((_, fn) => fn(tx)),
    };
    const service = new AuthService(db as unknown as Database, { enabled: false } as MailAdapter);
    await service.register({
      email: 'invited@example.test',
      password: 'long-password-for-test',
      displayName: 'Recipient',
      timezone: 'UTC',
      language: 'en',
      inviteToken: 'invitation-token-123',
    });
    expect(tx.invitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: hashToken('invitation-token-123'),
          email: 'invited@example.test',
          status: 'PENDING',
          recipientId: null,
        }),
        data: { recipientId: 'recipient' },
      }),
    );
    expect(tx.friendship.create).not.toHaveBeenCalled();
  });

  it('creates a pending request when the bound recipient verifies their email', async () => {
    const tx = {
      authToken: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            id: 'verification',
            userId: 'recipient',
            usedAt: null,
            expiresAt: new Date(Date.now() + 60000),
            purpose: 'VERIFY_EMAIL',
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: vi.fn().mockResolvedValue({ email: 'invited@example.test' }) },
      invitation: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'inv',
            senderId: 'sender',
            sender: { profile: { displayName: 'Sender' } },
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      friendship: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      profile: { findMany: vi.fn().mockResolvedValue([{ userId: 'recipient', language: 'en' }]) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const db = {
      $transaction: vi.fn().mockImplementation((fn) => fn(tx)),
      lockActive: vi.fn().mockResolvedValue({}),
    };
    const service = new AuthService(db as unknown as Database, { enabled: false } as MailAdapter);
    await service.consume('verification-token', 'VERIFY_EMAIL');
    expect(tx.invitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientId: 'recipient',
          email: 'invited@example.test',
          status: 'PENDING',
        }),
      }),
    );
    expect(tx.friendship.create).toHaveBeenCalledWith({
      data: {
        senderId: 'sender',
        receiverId: 'recipient',
        pairKey: 'recipient:sender',
        status: 'PENDING',
      },
    });
    expect(tx.notification.createMany).toHaveBeenCalledOnce();
  });
});
