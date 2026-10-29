import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { DeliveryError, classifyDeliveryError } from '../mail.types';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // failures to trip to OPEN (default: 5)
  rollingWindowMs?: number; // window for failure counting (default: 60000)
  cooldownMs?: number; // cooldown before transitioning to HALF_OPEN (default: 30000)
  requestTimeoutMs?: number; // timeout per request (default: 10000)
  maxTransientRetries?: number; // retries for transient errors (default: 1)
  retryBackoffMs?: number; // backoff before retry (default: 250)
}

export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private state: CircuitState = 'CLOSED';
  private failureTimestamps: number[] = [];
  private lastStateChange: number = Date.now();
  private halfOpenProbeInFlight = false;

  readonly failureThreshold: number;
  readonly rollingWindowMs: number;
  readonly cooldownMs: number;
  readonly requestTimeoutMs: number;
  readonly maxTransientRetries: number;
  readonly retryBackoffMs: number;

  constructor(
    readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.rollingWindowMs = options.rollingWindowMs ?? 60000;
    this.cooldownMs = options.cooldownMs ?? 30000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10000;
    this.maxTransientRetries = options.maxTransientRetries ?? 1;
    this.retryBackoffMs = options.retryBackoffMs ?? 250;
  }

  getState(): CircuitState {
    const now = Date.now();
    if (this.state === 'OPEN' && now - this.lastStateChange >= this.cooldownMs) {
      this.transitionTo('HALF_OPEN', 'Cooldown elapsed, probing service');
    }
    return this.state;
  }

  private transitionTo(newState: CircuitState, reason: string) {
    const from = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    if (newState === 'CLOSED') {
      this.failureTimestamps = [];
      this.halfOpenProbeInFlight = false;
    }
    this.logger.warn(
      JSON.stringify({
        level: 'warn',
        event: 'circuit_breaker_state_transition',
        circuit: this.name,
        from,
        to: newState,
        reason,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new ServiceUnavailableException(
        `Email service for ${this.name} is temporarily unavailable (circuit breaker open).`,
      );
    }

    if (currentState === 'HALF_OPEN') {
      if (this.halfOpenProbeInFlight) {
        throw new ServiceUnavailableException(
          `Email service for ${this.name} is currently testing recovery probe.`,
        );
      }
      this.halfOpenProbeInFlight = true;
    }

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => {
            reject(
              new DeliveryError('temporary', `Request timed out after ${this.requestTimeoutMs}ms`),
            );
          }, this.requestTimeoutMs);
          timer.unref?.();
        });

        const result = await Promise.race([action(), timeoutPromise]);
        this.onSuccess();
        return result;
      } catch (error) {
        const classification = classifyDeliveryError(error);
        const isTransient = classification === 'temporary';

        // Retry transient errors only if budget remains
        if (isTransient && attempt <= this.maxTransientRetries) {
          if (this.retryBackoffMs > 0) {
            await new Promise((r) => setTimeout(r, this.retryBackoffMs));
          }
          continue;
        }

        // Record failure against circuit
        this.onFailure(isTransient);
        throw error;
      }
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('CLOSED', 'Probe request succeeded');
    }
    this.failureTimestamps = [];
    this.halfOpenProbeInFlight = false;
  }

  private onFailure(_isTransient: boolean) {
    const now = Date.now();
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN', 'Probe request failed');
      return;
    }

    // Prune failures outside rolling window
    this.failureTimestamps = this.failureTimestamps.filter((ts) => now - ts < this.rollingWindowMs);
    this.failureTimestamps.push(now);

    if (this.failureTimestamps.length >= this.failureThreshold) {
      this.transitionTo(
        'OPEN',
        `Failure threshold (${this.failureThreshold} errors in ${this.rollingWindowMs}ms) exceeded`,
      );
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failureTimestamps = [];
    this.lastStateChange = Date.now();
    this.halfOpenProbeInFlight = false;
  }

  forceOpen() {
    this.transitionTo('OPEN', 'Forced open');
  }

  forceHalfOpen() {
    this.transitionTo('HALF_OPEN', 'Forced half-open');
  }
}
