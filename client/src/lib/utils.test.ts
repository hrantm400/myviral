import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn (Tailwind Class Merge Utility)', () => {
  it('should merge basic class names properly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle conditional classes using clsx syntax', () => {
    expect(cn({ class1: true, class2: false, class3: true })).toBe('class1 class3');
  });

  it('should handle arrays of classes', () => {
    expect(cn(['class1', 'class2'])).toBe('class1 class2');
    expect(cn(['class1', { class2: true, class3: false }])).toBe('class1 class2');
  });

  it('should ignore falsy values', () => {
    expect(cn('class1', null, undefined, false, 0, '', 'class2')).toBe('class1 class2');
  });

  it('should merge tailwind classes properly using twMerge', () => {
    // Basic overrides
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');

    // Complex overrides with identical properties but different states
    expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe('hover:bg-blue-500');
    expect(cn('bg-red-500 hover:bg-red-600', 'bg-blue-500')).toBe('hover:bg-red-600 bg-blue-500');

    // Width and height
    expect(cn('w-10', 'w-20')).toBe('w-20');
    expect(cn('h-10', 'h-20')).toBe('h-20');

    // Margins and paddings
    expect(cn('m-2 mt-4', 'm-6')).toBe('m-6');
    expect(cn('m-2', 'mt-4')).toBe('m-2 mt-4');
  });

  it('should handle complex combinations of clsx and tailwind-merge', () => {
    expect(
      cn(
        'base-class p-4 text-center',
        {
          'text-red-500': true,
          'p-8': true, // Should override p-4
          'opacity-50': false,
        },
        ['w-full', 'md:w-1/2'],
        null,
        undefined
      )
    ).toBe('base-class text-center text-red-500 p-8 w-full md:w-1/2');
  });
});
