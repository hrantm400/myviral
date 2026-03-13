import { describe, it, expect } from 'vitest';
import { formatASSTime } from './ffmpeg';

describe('formatASSTime', () => {
  it('formats exactly 0 seconds', () => {
    expect(formatASSTime(0)).toBe('0:00:00.00');
  });

  it('formats sub-second values', () => {
    expect(formatASSTime(0.5)).toBe('0:00:00.50');
    expect(formatASSTime(0.12)).toBe('0:00:00.12');
    // Math.round((0.123 % 1) * 100) -> 12
    expect(formatASSTime(0.123)).toBe('0:00:00.12');
    // Math.round((0.128 % 1) * 100) -> 13
    expect(formatASSTime(0.128)).toBe('0:00:00.13');
  });

  it('formats exactly one minute', () => {
    expect(formatASSTime(60)).toBe('0:01:00.00');
  });

  it('formats minutes and seconds', () => {
    expect(formatASSTime(65)).toBe('0:01:05.00');
    expect(formatASSTime(125)).toBe('0:02:05.00');
    expect(formatASSTime(3599)).toBe('0:59:59.00');
  });

  it('formats exactly one hour', () => {
    expect(formatASSTime(3600)).toBe('1:00:00.00');
  });

  it('formats hours, minutes, seconds, and centiseconds', () => {
    // 1 hour = 3600s
    // 2 minutes = 120s
    // 5 seconds = 5s
    // 0.45 seconds
    // Total: 3725.45s
    expect(formatASSTime(3725.45)).toBe('1:02:05.45');

    // 10 hours = 36000s
    // 59 minutes = 3540s
    // 59 seconds = 59s
    // 0.99 seconds
    // Total: 39599.99s
    expect(formatASSTime(39599.99)).toBe('10:59:59.99');
  });

  it('formats centiseconds close to whole second', () => {
    expect(formatASSTime(0.99)).toBe('0:00:00.99');
  });

  it('formats centiseconds rounding up to whole second', () => {
    // 0.999 * 100 = 99.9, rounds to 100 centiseconds -> 1 second
    expect(formatASSTime(0.999)).toBe('0:00:01.00');
  });
});
