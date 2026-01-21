/**
 * Persistence Utilities Unit Tests
 * 
 * Tests for localStorage persistence utilities used by form drafts
 * and dashboard collapse state.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getPersistedBool,
  setPersistedBoolImmediate,
  removePersistedValue,
  getPersistedJson,
  setPersistedJsonImmediate,
  PERSISTENCE_KEYS,
} from '@/lib/persistence';

// =============================================================================
// TEST SETUP
// =============================================================================

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

beforeEach(() => {
  // Clear storage and mocks before each test
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// BOOLEAN PERSISTENCE TESTS
// =============================================================================

describe('getPersistedBool', () => {
  it('returns default value when key does not exist', () => {
    const result = getPersistedBool('nonexistent-key', true);
    expect(result).toBe(true);
    
    const result2 = getPersistedBool('another-nonexistent', false);
    expect(result2).toBe(false);
  });

  it('returns stored true value', () => {
    localStorageMock.setItem('test-bool-true', 'true');
    const result = getPersistedBool('test-bool-true', false);
    expect(result).toBe(true);
  });

  it('returns stored false value', () => {
    localStorageMock.setItem('test-bool-false', 'false');
    const result = getPersistedBool('test-bool-false', true);
    expect(result).toBe(false);
  });

  it('returns default for invalid JSON', () => {
    localStorageMock.setItem('invalid-json', 'not-valid-json');
    const result = getPersistedBool('invalid-json', true);
    expect(result).toBe(true);
  });

  it('returns default for non-boolean values', () => {
    localStorageMock.setItem('string-value', '"hello"');
    const result = getPersistedBool('string-value', false);
    expect(result).toBe(false);
    
    localStorageMock.setItem('number-value', '42');
    const result2 = getPersistedBool('number-value', true);
    expect(result2).toBe(false); // 42 !== true, so returns false
  });
});

describe('setPersistedBoolImmediate', () => {
  it('stores true value', () => {
    setPersistedBoolImmediate('test-key', true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', 'true');
  });

  it('stores false value', () => {
    setPersistedBoolImmediate('test-key', false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', 'false');
  });

  it('coerces truthy values to true', () => {
    // @ts-expect-error - Testing truthy coercion
    setPersistedBoolImmediate('test-key', 1);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', 'true');
  });

  it('coerces falsy values to false', () => {
    // @ts-expect-error - Testing falsy coercion
    setPersistedBoolImmediate('test-key', 0);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', 'false');
  });
});

// =============================================================================
// JSON PERSISTENCE TESTS
// =============================================================================

describe('getPersistedJson', () => {
  it('returns null when key does not exist', () => {
    const result = getPersistedJson('nonexistent-key');
    expect(result).toBeNull();
  });

  it('returns parsed object', () => {
    const testObj = { name: 'test', value: 123, nested: { flag: true } };
    localStorageMock.setItem('test-obj', JSON.stringify(testObj));
    
    const result = getPersistedJson<typeof testObj>('test-obj');
    expect(result).toEqual(testObj);
  });

  it('returns parsed array', () => {
    const testArr = [1, 2, 3, 'four', { five: 5 }];
    localStorageMock.setItem('test-arr', JSON.stringify(testArr));
    
    const result = getPersistedJson<typeof testArr>('test-arr');
    expect(result).toEqual(testArr);
  });

  it('returns parsed primitive values', () => {
    localStorageMock.setItem('test-string', '"hello"');
    expect(getPersistedJson('test-string')).toBe('hello');
    
    localStorageMock.setItem('test-number', '42');
    expect(getPersistedJson('test-number')).toBe(42);
    
    localStorageMock.setItem('test-null', 'null');
    expect(getPersistedJson('test-null')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    localStorageMock.setItem('invalid-json', '{not valid json}');
    const result = getPersistedJson('invalid-json');
    expect(result).toBeNull();
  });
});

describe('setPersistedJsonImmediate', () => {
  it('stores object as JSON', () => {
    const testObj = { name: 'test', value: 123 };
    setPersistedJsonImmediate('test-key', testObj);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(testObj));
  });

  it('stores array as JSON', () => {
    const testArr = [1, 2, 3];
    setPersistedJsonImmediate('test-key', testArr);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', '[1,2,3]');
  });

  it('stores primitive values', () => {
    setPersistedJsonImmediate('test-string', 'hello');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-string', '"hello"');
    
    setPersistedJsonImmediate('test-number', 42);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-number', '42');
    
    setPersistedJsonImmediate('test-bool', true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-bool', 'true');
  });

  it('stores null', () => {
    setPersistedJsonImmediate('test-null', null);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-null', 'null');
  });

  it('handles nested objects', () => {
    const nested = {
      level1: {
        level2: {
          level3: { value: 'deep' },
        },
      },
    };
    setPersistedJsonImmediate('test-nested', nested);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-nested', JSON.stringify(nested));
  });
});

// =============================================================================
// REMOVE TESTS
// =============================================================================

describe('removePersistedValue', () => {
  it('removes existing key', () => {
    localStorageMock.setItem('to-remove', 'value');
    removePersistedValue('to-remove');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('to-remove');
  });

  it('handles non-existent key gracefully', () => {
    removePersistedValue('never-existed');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('never-existed');
    // Should not throw
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Round-trip persistence', () => {
  it('boolean round-trip works correctly', () => {
    setPersistedBoolImmediate('round-trip-bool', true);
    const result = getPersistedBool('round-trip-bool', false);
    expect(result).toBe(true);
    
    setPersistedBoolImmediate('round-trip-bool', false);
    const result2 = getPersistedBool('round-trip-bool', true);
    expect(result2).toBe(false);
  });

  it('JSON object round-trip works correctly', () => {
    const original = {
      form: { truckNumber: 'B132', notes: 'Test notes' },
      currentStep: 2,
      completedSteps: [0, 1],
      savedAt: '2026-01-20T10:00:00Z',
      userId: 'user-123',
    };
    
    setPersistedJsonImmediate('round-trip-json', original);
    const retrieved = getPersistedJson<typeof original>('round-trip-json');
    
    expect(retrieved).toEqual(original);
    expect(retrieved?.form.truckNumber).toBe('B132');
    expect(retrieved?.completedSteps).toEqual([0, 1]);
  });

  it('remove then get returns default/null', () => {
    setPersistedBoolImmediate('to-remove', true);
    expect(getPersistedBool('to-remove', false)).toBe(true);
    
    removePersistedValue('to-remove');
    expect(getPersistedBool('to-remove', false)).toBe(false);
    
    setPersistedJsonImmediate('json-to-remove', { data: 'test' });
    expect(getPersistedJson('json-to-remove')).toEqual({ data: 'test' });
    
    removePersistedValue('json-to-remove');
    expect(getPersistedJson('json-to-remove')).toBeNull();
  });
});

// =============================================================================
// PERSISTENCE KEYS TESTS
// =============================================================================

describe('PERSISTENCE_KEYS', () => {
  it('has expected dashboard collapse keys', () => {
    expect(PERSISTENCE_KEYS.ANNOUNCEMENTS).toBe('atts:dashboard:collapse:announcements');
    expect(PERSISTENCE_KEYS.ASSIGNED_JOBS).toBe('atts:dashboard:collapse:assignedJobs');
    expect(PERSISTENCE_KEYS.QUICK_ACTIONS).toBe('atts:dashboard:collapse:quickActions');
    expect(PERSISTENCE_KEYS.ALL_TOOLS).toBe('atts:dashboard:collapse:allTools');
  });

  it('has pinned favorites key', () => {
    expect(PERSISTENCE_KEYS.PINNED_FAVORITES).toBe('dashboard-pinned-favorites');
  });

  it('keys are unique', () => {
    const values = Object.values(PERSISTENCE_KEYS);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  it('handles empty string key', () => {
    setPersistedBoolImmediate('', true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('', 'true');
    
    const result = getPersistedBool('', false);
    expect(result).toBe(true);
  });

  it('handles very long key names', () => {
    const longKey = 'a'.repeat(1000);
    setPersistedJsonImmediate(longKey, { test: true });
    expect(localStorageMock.setItem).toHaveBeenCalled();
    
    const result = getPersistedJson(longKey);
    expect(result).toEqual({ test: true });
  });

  it('handles special characters in values', () => {
    const specialData = {
      text: 'Hello\nWorld\t"Quoted"',
      unicode: '🎉 祝贺 العربية',
      html: '<script>alert("xss")</script>',
    };
    
    setPersistedJsonImmediate('special-chars', specialData);
    const result = getPersistedJson<typeof specialData>('special-chars');
    
    expect(result).toEqual(specialData);
    expect(result?.unicode).toBe('🎉 祝贺 العربية');
  });

  it('handles Date objects (serializes to string)', () => {
    const withDate = {
      createdAt: new Date('2026-01-20T10:00:00Z'),
    };
    
    setPersistedJsonImmediate('with-date', withDate);
    const result = getPersistedJson<{ createdAt: string }>('with-date');
    
    // Date becomes ISO string in JSON
    expect(result?.createdAt).toBe('2026-01-20T10:00:00.000Z');
  });

  it('handles undefined values in objects (omitted in JSON)', () => {
    const withUndefined = {
      defined: 'value',
      notDefined: undefined,
    };
    
    setPersistedJsonImmediate('with-undefined', withUndefined);
    const result = getPersistedJson<typeof withUndefined>('with-undefined');
    
    expect(result?.defined).toBe('value');
    expect(result).not.toHaveProperty('notDefined');
  });
});
