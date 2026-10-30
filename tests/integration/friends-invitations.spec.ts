import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FriendsService } from '../../apps/api/src/social/friends.service';
import { Database } from '../../apps/api/src/common/database';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';
import { hashToken } from '../../apps/api/src/auth/auth.guard';

describe('friend email invitations workflow', () => {
  it('sends a branded invite for an address without a MIRHAL account', async () => {
    const invitations: any[] = [];
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
    };
    const mail = { sendFriendInvite: vi.fn().mockResolvedValue(undefined) };
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
      expect.stringContaining('sender-1:newfriend@example.test:'),
      'en',
      expect.any(String),
    );
  });

  it('blocks external invitations until the sender verifies their email', async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sender-1',
          email: 'unverified@example.test',
          emailVerifiedAt: null,
          profile: null,
        }),
      },
    };
    const mail = { sendFriendInvite: vi.fn() };
    const service = new FriendsService(db as unknown as Database, mail as unknown as MailAdapter);

    await expect(service.request('sender-1', 'friend@example.test')).rejects.toThrow(
      BadRequestException,
    );
    expect(mail.sendFriendInvite).not.toHaveBeenCalled();
  });

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
          update: vi.fn().mockResolvedValue({}),
        },
      };
      const service = new FriendsService(db as unknown as Database, {} as unknown as MailAdapter);

      const resolved = await service.resolveInvitation(token);
      expect(resolved).toEqual({
        valid: false,
        reason: 'expired',
      });
      expect(db.invitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-2' },
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
    it('accepts invitation and connects friends', async () => {
      const token = 'valid-token-to-accept-1234567890';
      const tokenHash = hashToken(token);
      let updatedInv: any = null;
      let createdFriendship: any = null;
      const db = {
        invitation: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'inv-4',
            senderId: 'sender-1',
            tokenHash,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000),
          }),
        },
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'user-2',
            email: 'invited@example.test',
            profile: { displayName: 'New User' },
          }),
        },
        atomic: vi.fn().mockImplementation((_, fn) =>
          fn({
            invitation: {
              update: vi.fn().mockImplementation(({ data }) => {
                updatedInv = data;
                return Promise.resolve({});
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
      expect(updatedInv.status).toBe('ACCEPTED');
      expect(createdFriendship.senderId).toBe('sender-1');
      expect(createdFriendship.receiverId).toBe('user-2');
      expect(createdFriendship.receiverId).toBe('user-2');
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
