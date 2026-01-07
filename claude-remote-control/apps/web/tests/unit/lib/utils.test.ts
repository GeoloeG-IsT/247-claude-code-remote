/**
 * Utils Module Tests
 *
 * Tests for the cn utility function used for className merging.
 */
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('Utils', () => {
  describe('cn function', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      const showBar = true;
      const showBaz = false;
      expect(cn('foo', showBar && 'bar', showBaz && 'baz')).toBe('foo bar');
    });

    it('handles undefined values', () => {
      expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    });

    it('handles null values', () => {
      expect(cn('foo', null, 'bar')).toBe('foo bar');
    });

    it('handles arrays of classes', () => {
      expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
    });

    it('handles object notation', () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
    });

    it('merges Tailwind classes correctly', () => {
      // tw-merge should keep only the last conflicting utility
      expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('merges color utilities correctly', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('keeps non-conflicting classes', () => {
      expect(cn('p-2', 'm-4', 'text-lg')).toBe('p-2 m-4 text-lg');
    });

    it('handles empty input', () => {
      expect(cn()).toBe('');
    });

    it('handles single class', () => {
      expect(cn('foo')).toBe('foo');
    });

    it('handles complex conditional expressions', () => {
      const isActive = true;
      const isDisabled = false;

      expect(
        cn('base-class', isActive && 'active-class', isDisabled && 'disabled-class', {
          'object-class': true,
          'hidden-class': false,
        })
      ).toBe('base-class active-class object-class');
    });

    it('handles Tailwind responsive utilities', () => {
      expect(cn('p-2', 'sm:p-4', 'md:p-6')).toBe('p-2 sm:p-4 md:p-6');
    });

    it('handles Tailwind state modifiers', () => {
      expect(cn('hover:bg-blue-500', 'focus:bg-blue-600')).toBe(
        'hover:bg-blue-500 focus:bg-blue-600'
      );
    });
  });
});
