import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';
import { Database } from '../../apps/api/src/common/database';

function createService(sendPasswordChanged = vi.fn().mockResolvedValue(undefined)) {
  const tx = {
    authToken: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'reset-token-record',
        userId: 'member-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        purpose: 'RESET_PASSWORD',
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        email: 'member@example.test',
        profile: { language: 'en' },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
  const database = {
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    lockActive: vi.fn().mockResolvedValue(undefined),
  };
  const mail = { enabled: true, sendPasswordChanged };
  return {
    service: new AuthService(database as unknown as Database, mail as unknown as MailAdapter),
    database,
    tx,
    sendPasswordChanged,
  };
}

describe('Password reset security notice', () => {
  it('sends a token-free, idempotent notice after the reset transaction commits', async () => {
    const { service, database, tx, sendPasswordChanged } = createService();

    await expect(
      service.consume('raw-reset-token', 'RESET_PASSWORD', 'a-new-long-password'),
    ).resolves.toEqual({
      success: true,
    });

    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'member-1' } });
    expect(sendPasswordChanged).toHaveBeenCalledWith(
      'member@example.test',
      'reset-token-record',
      'en',
    );
  });

  it('keeps a committed password reset successful when the notice provider fails', async () => {
    const { service, sendPasswordChanged } = createService(
      vi.fn().mockRejectedValue(new ServiceUnavailableException('Provider unavailable')),
    );

    await expect(
      service.consume('raw-reset-token', 'RESET_PASSWORD', 'a-new-long-password'),
    ).resolves.toEqual({
      success: true,
    });
    expect(sendPasswordChanged).toHaveBeenCalledOnce();
  });
});
