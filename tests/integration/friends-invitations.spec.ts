import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FriendsService } from '../../apps/api/src/social/friends.service';
import { Database } from '../../apps/api/src/common/database';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';
import { hashToken } from '../../apps/api/src/auth/auth.guard';
import { DeliveryError } from '../../apps/api/src/mail/mail.types';

describe('friend email invitations workflow', () => {
  it('sends a branded invite for an address without a MIRHAL account', async () => {
    const invitations: { expiresAt: Date; tokenHash: string }[] = [];
    const db = {
      user: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'sender-1') {
            return Promise.resolve({
              id: 'sender-1',
              email: 'nour@example.test',
              emailVerifiedAt: new Date(),
              profile: { displayName: 'Nour', language: 'en' },
            });
          }
          if (where.email === 'newfriend@example.test') {
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        }),
      },
      invitation: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => {
          invitations.push(data);
          return Promise.resolve({ id: 'inv-1', ...data });
        }),
      },
      atomic: vi.fn().mockImplementation((_, fn) => fn({ invitation: db.invitation })),
    };
    const mail = {
      assertConfigured: vi.fn(),
      sendFriendInvite: vi.fn().mockResolvedValue(undefined),
    };
    const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);

    const result = await service.request('sender-1', 'newfriend@example.test');
    expect(result).toEqual({ channel: 'email', status: 'accepted' });

    expect(db.invitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        senderId: 'sender-1',
        email: 'newfriend@example.test',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });

    const created = invitations[0];
    const diffDays = (created.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThanOrEqual(7.01);

    expect(mail.sendFriendInvite).toHaveBeenCalledWith(
      'newfriend@example.test',
      'Nour',
      created.tokenHash,
      'en',
      expect.any(String),
    );
  });

  it('blocks external invitations until the sender verifies their email', async () => {
    const db = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'sender-1',
            email: 'unverified@example.test',
            emailVerifiedAt: null,
            profile: null,
          })
          .mockResolvedValueOnce(null),
      },
    };
    const mail = { sendFriendInvite: vi.fn() };
    const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);

    await expect(service.request('sender-1', 'friend@example.test')).rejects.toThrow(
      BadRequestException,
    );
    expect(mail.sendFriendInvite).not.toHaveBeenCalled();
  });

  it('uses a distinct provider idempotency key when a new invitation token is issued', async () => {
    const sender = {
      id: 'sender',
      email: 'sender@example.test',
      emailVerifiedAt: new Date(),
      profile: null,
    };
    const db = {
      user: {
        findUnique: vi
          .fn()
          .mockImplementation(({ where }) => Promise.resolve(where.id ? sender : null)),
      },
      invitation: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      atomic: vi.fn().mockImplementation((_, fn) => fn({ invitation: db.invitation })),
    };
    const mail = {
      assertConfigured: vi.fn(),
      sendFriendInvite: vi.fn().mockResolvedValue(undefined),
    };
    const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);
    await service.request('sender', 'recipient@example.test');
    await service.request('sender', 'recipient@example.test');
    const [first, second] = mail.sendFriendInvite.mock.calls;
    expect(first[2]).not.toBe(second[2]);
    expect(first[2]).toBe(hashToken(first[4]));
    expect(second[2]).toBe(hashToken(second[4]));
  });

  it('rejects an existing unexpired invitation without sending another email', async () => {
    const sender = {
      id: 'sender',
      email: 'sender@example.test',
      emailVerifiedAt: new Date(),
      profile: null,
    };
    const mail = { assertConfigured: vi.fn(), sendFriendInvite: vi.fn() };
    const db = {
      user: {
        findUnique: vi
          .fn()
          .mockImplementation(({ where }) => Promise.resolve(where.id ? sender : null)),
      },
      atomic: vi
        .fn()
        .mockImplementation((_, fn) =>
          fn({
            invitation: {
              findFirst: vi.fn().mockResolvedValue({ id: 'pending' }),
              create: vi.fn(),
            },
          }),
        ),
    };
    const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);
    await expect(service.request('sender', 'recipient@example.test')).rejects.toThrow(
      ConflictException,
    );
    expect(mail.sendFriendInvite).not.toHaveBeenCalled();
  });

  it.each(['temporary', 'permanent'] as const)(
    'handles a %s provider failure without claiming delivery',
    async (classification) => {
      const sender = {
        id: 'sender',
        email: 'sender@example.test',
        emailVerifiedAt: new Date(),
        profile: null,
      };
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const db = {
        user: {
          findUnique: vi
            .fn()
            .mockImplementation(({ where }) => Promise.resolve(where.id ? sender : null)),
        },
        invitation: { updateMany },
        atomic: vi
          .fn()
          .mockImplementation((_, fn) =>
            fn({
              invitation: {
                findFirst: vi.fn().mockResolvedValue(null),
                create: vi.fn().mockResolvedValue({}),
              },
            }),
          ),
      };
      const mail = {
        assertConfigured: vi.fn(),
        sendFriendInvite: vi.fn().mockRejectedValue(new DeliveryError(classification)),
      };
      const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);
      await expect(service.request('sender', 'recipient@example.test')).rejects.toThrow(
        DeliveryError,
      );
      expect(updateMany).toHaveBeenCalledTimes(classification === 'permanent' ? 1 : 0);
    },
  );

  it('blocks self invitation with a clear message', async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sender-1',
          email: 'self@example.test',
          emailVerifiedAt: new Date(),
          profile: { displayName: 'Self' },
        }),
      },
    };
    const mail = { sendFriendInvite: vi.fn() };
    const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);

    await expect(service.request('sender-1', 'self@example.test')).rejects.toThrow(
      'You cannot send a friend request to yourself.',
    );
  });

  it.each(['accepted', 'unavailable', 'disabled'] as const)('creates the registered request and reports email %s', async (emailStatus) => {
    const sender = { id: 'sender', email: 'sender@example.test', emailVerifiedAt: new Date(), profile: { displayName: 'Sender' } };
    const receiver = { id: 'receiver', status: 'ACTIVE', emailVerifiedAt: new Date(), profile: { language: 'en', notificationsEnabled: emailStatus !== 'disabled' } };
    const mail = { enabled: true, sendFriendInvite: emailStatus === 'unavailable' ? vi.fn().mockRejectedValue(new Error('provider failure')) : vi.fn().mockResolvedValue(undefined) };
    const tx = {
      friendship: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'friendship', status: 'PENDING', updatedAt: new Date('2026-10-30T00:00:00Z') }) },
      profile: { findUnique: vi.fn().mockResolvedValue({ displayName: 'Sender' }), findMany: vi.fn().mockResolvedValue([{ userId: 'receiver', language: 'en' }]) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const db = { user: { findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve(where.id ? sender : receiver)) }, atomic: vi.fn().mockImplementation((_, fn) => fn(tx)) };
    const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);
    const result = await service.request('sender', 'receiver@example.test');
    expect(result).toEqual({ channel: 'friendship', id: 'friendship', status: 'PENDING', emailStatus });
    expect(tx.notification.createMany).toHaveBeenCalledOnce();
    expect(mail.sendFriendInvite).toHaveBeenCalledTimes(emailStatus === 'disabled' ? 0 : 1);
    if (emailStatus !== 'disabled') expect(mail.sendFriendInvite).toHaveBeenCalledWith('receiver@example.test', 'Sender', expect.any(String), 'en', undefined, true);
  });

  it('rejects duplicate friend request when already accepted', async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'user-1') {
            return Promise.resolve({
              id: 'user-1',
              email: 'user1@example.test',
              emailVerifiedAt: new Date(),
              profile: { displayName: 'User One' },
            });
          }
          if (where.email === 'user2@example.test') {
            return Promise.resolve({ id: 'user-2', status: 'ACTIVE' });
          }
          return Promise.resolve(null);
        }),
      },
      atomic: vi.fn().mockImplementation((_, fn) =>
        fn({
          friendship: {
            findUnique: vi.fn().mockResolvedValue({ id: 'fr-1', status: 'ACCEPTED' }),
          },
        }),
      ),
    };
    const mail = { sendFriendInvite: vi.fn() };
    const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);

    await expect(service.request('user-1', 'user2@example.test')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects duplicate friend request when request is already pending', async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'user-1') {
            return Promise.resolve({
              id: 'user-1',
              email: 'user1@example.test',
              emailVerifiedAt: new Date(),
              profile: { displayName: 'User One' },
            });
          }
          if (where.email === 'user2@example.test') {
            return Promise.resolve({ id: 'user-2', status: 'ACTIVE' });
          }
          return Promise.resolve(null);
        }),
      },
      atomic: vi.fn().mockImplementation((_, fn) =>
        fn({
          friendship: {
            findUnique: vi.fn().mockResolvedValue({ id: 'fr-1', status: 'PENDING' }),
          },
        }),
      ),
    };
    const mail = { sendFriendInvite: vi.fn() };
    const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);

    await expect(service.request('user-1', 'user2@example.test')).rejects.toThrow(
      'A friend request is already pending with this person.',
    );
  });

  describe('resolveInvitation', () => {
    it('resolves a valid pending invitation', async () => {
      const token = 'test-token-1234567890abcdef1234567890';
      const tokenHash = hashToken(token);
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv-1',
            tokenHash,
            email: 'invited@example.test',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000),
            sender: { profile: { displayName: 'Layla' } },
          }),
        },
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);

      const resolved = await service.resolveInvitation(token);
      expect(resolved).toEqual({
        valid: true,
        email: 'invited@example.test',
        inviterName: 'Layla',
      });
    });

    it('returns expired status for expired invitations and marks EXPIRED', async () => {
      const token = 'expired-token-1234567890abcdef';
      const tokenHash = hashToken(token);
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv-2',
            tokenHash,
            email: 'invited@example.test',
            status: 'PENDING',
            expiresAt: new Date(Date.now() - 1000),
            sender: { profile: { displayName: 'Layla' } },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);

      const resolved = await service.resolveInvitation(token);
      expect(resolved).toEqual({
        valid: false,
        reason: 'expired',
      });
      expect(db.invitation.updateMany).toHaveBeenCalledWith({
        where: { id: 'inv-2', tokenHash, status: 'PENDING', expiresAt: { lte: expect.any(Date) } },
        data: { status: 'EXPIRED' },
      });
    });

    it('returns already-used for accepted invitations', async () => {
      const token = 'used-token-1234567890abcdef';
      const tokenHash = hashToken(token);
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv-3',
            tokenHash,
            status: 'ACCEPTED',
            expiresAt: new Date(Date.now() + 86400000),
            sender: { profile: { displayName: 'Layla' } },
          }),
        },
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);

      const resolved = await service.resolveInvitation(token);
      expect(resolved).toEqual({
        valid: false,
        reason: 'already-used',
      });
    });
  });

  describe('acceptInvitation', () => {
    it('redeems a verified recipient invitation as a pending friend request', async () => {
      const token = 'valid-token-to-accept-1234567890';
      const tokenHash = hashToken(token);
      let updatedInv: { status: string } | null = null;
      let createdFriendship: { senderId: string; receiverId: string; status: string } | null = null;
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv-4',
            senderId: 'sender-1',
            email: 'invited@example.test',
            tokenHash,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000),
          }),
        },
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'user-2',
            email: 'invited@example.test',
            emailVerifiedAt: new Date(),
          }),
        },
        atomic: vi.fn().mockImplementation((_, fn) =>
          fn({
            user: {
              findUniqueOrThrow: vi
                .fn()
                .mockResolvedValue({ email: 'invited@example.test', emailVerifiedAt: new Date() }),
            },
            invitation: {
              updateMany: vi.fn().mockImplementation(({ data }) => {
                updatedInv = data;
                return Promise.resolve({ count: 1 });
              }),
            },
            friendship: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockImplementation(({ data }) => {
                createdFriendship = data;
                return Promise.resolve({ id: 'fr-new', ...data });
              }),
            },
            notification: {
              create: vi.fn().mockResolvedValue({}),
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            profile: {
              findMany: vi.fn().mockResolvedValue([]),
            },
          }),
        ),
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);

      const result = await service.acceptInvitation('user-2', token);
      expect(result.success).toBe(true);
      expect(result.friendshipId).toBe('fr-new');
      expect(updatedInv).toEqual(expect.objectContaining({ status: 'ACCEPTED' }));
      expect(createdFriendship).toEqual(
        expect.objectContaining({
          senderId: 'sender-1',
          receiverId: 'user-2',
          status: 'PENDING',
        }),
      );
    });

    it('rejects a different recipient', async () => {
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv',
            senderId: 'sender',
            email: 'invited@example.test',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000),
          }),
        },
        atomic: vi.fn().mockImplementation((_, fn) =>
          fn({
            user: {
              findUniqueOrThrow: vi
                .fn()
                .mockResolvedValue({ email: 'other@example.test', emailVerifiedAt: new Date() }),
            },
          }),
        ),
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);
      await expect(service.acceptInvitation('receiver', 'token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('binds the matching unverified account without consuming the invitation', async () => {
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv',
            senderId: 'sender',
            email: 'invited@example.test',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000),
          }),
        },
        atomic: vi.fn().mockImplementation((_, fn) =>
          fn({
            user: {
              findUniqueOrThrow: vi
                .fn()
                .mockResolvedValue({ email: 'invited@example.test', emailVerifiedAt: null }),
            },
            invitation: { updateMany },
          }),
        ),
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);
      expect(await service.acceptInvitation('receiver', 'token')).toEqual({
        success: true,
        status: 'awaiting_verification',
      });
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { recipientId: 'receiver' } }),
      );
    });

    it('rejects an invitation claimed by another request', async () => {
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv',
            senderId: 'sender',
            email: 'invited@example.test',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000),
          }),
        },
        user: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ email: 'invited@example.test', emailVerifiedAt: new Date() }),
        },
        atomic: vi.fn().mockImplementation((_, fn) =>
          fn({
            user: {
              findUniqueOrThrow: vi.fn().mockResolvedValue({
                email: 'invited@example.test',
                emailVerifiedAt: new Date(),
              }),
            },
            invitation: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
          }),
        ),
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);
      await expect(service.acceptInvitation('receiver', 'token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('never changes a blocked friendship when an invitation is redeemed', async () => {
      const updateFriendship = vi.fn();
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv',
            senderId: 'sender',
            email: 'invited@example.test',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000),
          }),
        },
        user: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ email: 'invited@example.test', emailVerifiedAt: new Date() }),
        },
        atomic: vi.fn().mockImplementation((_, fn) =>
          fn({
            user: {
              findUniqueOrThrow: vi
                .fn()
                .mockResolvedValue({ email: 'invited@example.test', emailVerifiedAt: new Date() }),
            },
            invitation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
            friendship: {
              findUnique: vi.fn().mockResolvedValue({ status: 'BLOCKED' }),
              update: updateFriendship,
            },
          }),
        ),
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);
      await expect(service.acceptInvitation('receiver', 'token')).rejects.toThrow(
        ForbiddenException,
      );
      expect(updateFriendship).not.toHaveBeenCalled();
    });

    it('rejects accepting own invitation', async () => {
      const token = 'valid-token-self-1234567890';
      const tokenHash = hashToken(token);
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv-5',
            senderId: 'user-1',
            tokenHash,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000),
          }),
        },
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);

      await expect(service.acceptInvitation('user-1', token)).rejects.toThrow(
        'You cannot accept your own invitation.',
      );
    });
  });
});
