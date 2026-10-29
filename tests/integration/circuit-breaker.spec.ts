import { describe, expect, it, vi } from 'vitest';
import { CircuitBreaker } from '../../apps/api/src/mail/circuit-breaker/circuit-breaker';
import { DeliveryError } from '../../apps/api/src/mail/mail.types';
import { ServiceUnavailableException } from '@nestjs/common';

describe('Mail Circuit Breaker', () => {
  it('starts in CLOSED state and remains CLOSED on successes', async () => {
    const cb = new CircuitBreaker('test-service', { failureThreshold: 3 });
    expect(cb.getState()).toBe('CLOSED');

    const result = await cb.execute(async () => 'ok');
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('trips from CLOSED to OPEN when failure threshold is reached', async () => {
    const cb = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      rollingWindowMs: 10000,
    });

    const failingAction = async () => {
      throw new DeliveryError('temporary', 'network drop');
    };

    // 1st failure
    await expect(cb.execute(failingAction)).rejects.toThrow();
    expect(cb.getState()).toBe('CLOSED');

    // 2nd failure
    await expect(cb.execute(failingAction)).rejects.toThrow();
    expect(cb.getState()).toBe('CLOSED');

    // 3rd failure trips the breaker
    await expect(cb.execute(failingAction)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');
  });

  it('fast-fails immediately when OPEN without calling underlying service', async () => {
    const cb = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      cooldownMs: 10000,
    });
    cb.forceOpen();

    const mockAction = vi.fn().mockResolvedValue('ok');
    await expect(cb.execute(mockAction)).rejects.toThrow(ServiceUnavailableException);
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('transitions from OPEN to HALF_OPEN after cooldown', async () => {
    const cb = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      cooldownMs: 50,
    });
    cb.forceOpen();
    expect(cb.getState()).toBe('OPEN');

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('transitions from HALF_OPEN back to CLOSED on successful probe', async () => {
    const cb = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      cooldownMs: 50,
    });
    cb.forceHalfOpen();
    expect(cb.getState()).toBe('HALF_OPEN');

    const result = await cb.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('transitions from HALF_OPEN back to OPEN on failed probe', async () => {
    const cb = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      cooldownMs: 50,
    });
    cb.forceHalfOpen();
    expect(cb.getState()).toBe('HALF_OPEN');

    await expect(
      cb.execute(async () => {
        throw new DeliveryError('temporary', 'still broken');
      }),
    ).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');
  });

  it('enforces request timeout', async () => {
    const cb = new CircuitBreaker('test-service', {
      requestTimeoutMs: 50,
    });

    const hangingAction = () => new Promise((resolve) => setTimeout(resolve, 500));
    await expect(cb.execute(hangingAction)).rejects.toThrow(/timed out/);
  });
});
