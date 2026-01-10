/**
 * Frontend Profiler Tests
 * 
 * These tests validate that the frontend profiling utilities correctly:
 * - Track parent-child relationships through the call stack
 * - Calculate span durations accurately
 * - Handle nested synchronous and asynchronous operations
 * - Integrate with React components via the Profiler API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startSpan,
  profileSync,
  profileAsync,
  createProfilerCallback,
  trackInteraction,
  ProfilerService
} from '@/lib/services';

// Mock the ProfilerService
vi.mock('@/lib/services/ProfilerService', () => ({
  ProfilerService: {
    recordFrontendSpan: vi.fn().mockResolvedValue(undefined),
    startSession: vi.fn().mockResolvedValue('test-session-id'),
    endSession: vi.fn().mockResolvedValue({
      session: { id: 'test-session-id', name: 'test' },
      breakdowns: [],
      topSpans: [],
      totalSpanTimeMs: 0
    }),
  }
}));

describe('FrontendProfiler - Parent-Child Relationships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track parent-child relationship in nested spans', async () => {
    const parent = startSpan('parent_operation', 'frontend_render');

    // Create child span while parent is active
    const child = startSpan('child_operation', 'frontend_render');
    await child.end();

    await parent.end();

    // Verify that child span was recorded with parent ID
    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(2);

    const parentCall = (ProfilerService.recordFrontendSpan as any).mock.calls[1][0];
    const childCall = (ProfilerService.recordFrontendSpan as any).mock.calls[0][0];

    expect(childCall.parentId).toBe(parent.id);
    expect(parentCall.parentId).toBeUndefined();
  });

  it('should handle deeply nested spans (3+ levels)', async () => {
    const level1 = startSpan('level_1', 'frontend_render');
    const level2 = startSpan('level_2', 'frontend_render');
    const level3 = startSpan('level_3', 'frontend_render');

    await level3.end();
    await level2.end();
    await level1.end();

    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(3);

    const calls = (ProfilerService.recordFrontendSpan as any).mock.calls;

    // Level 3 should have level 2 as parent
    expect(calls[0][0].parentId).toBe(level2.id);

    // Level 2 should have level 1 as parent
    expect(calls[1][0].parentId).toBe(level1.id);

    // Level 1 should have no parent
    expect(calls[2][0].parentId).toBeUndefined();
  });

  it('should handle sibling spans correctly', async () => {
    const parent = startSpan('parent', 'frontend_render');

    const child1 = startSpan('child_1', 'frontend_render');
    await child1.end();

    const child2 = startSpan('child_2', 'frontend_render');
    await child2.end();

    await parent.end();

    const calls = (ProfilerService.recordFrontendSpan as any).mock.calls;

    // Both children should have the same parent
    expect(calls[0][0].parentId).toBe(parent.id);
    expect(calls[1][0].parentId).toBe(parent.id);
  });
});

describe('FrontendProfiler - Synchronous Profiling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should profile synchronous operations', () => {
    let result = 0;

    profileSync('sync_calculation', 'frontend_render', () => {
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        result += i;
      }
      return result;
    });

    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(1);
    expect(result).toBeGreaterThan(0);
  });

  it('should capture duration for synchronous operations', () => {
    profileSync('timed_operation', 'frontend_render', () => {
      // Simulate work that takes time
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait for 10ms
      }
    });

    const call = (ProfilerService.recordFrontendSpan as any).mock.calls[0][0];

    // Duration should be at least 10ms (might be slightly more due to overhead)
    expect(call.durationMs).toBeGreaterThanOrEqual(9); // Allow for some timing variance
  });

  it('should track parent in nested sync operations', () => {
    profileSync('outer', 'frontend_render', () => {
      profileSync('inner', 'frontend_render', () => {
        // Inner operation
      });
    });

    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(2);

    const innerCall = (ProfilerService.recordFrontendSpan as any).mock.calls[0][0];
    const outerCall = (ProfilerService.recordFrontendSpan as any).mock.calls[1][0];

    expect(innerCall.parentId).toBeDefined();
    expect(outerCall.parentId).toBeUndefined();
  });
});

describe('FrontendProfiler - Asynchronous Profiling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should profile async operations', async () => {
    const result = await profileAsync('async_fetch', 'frontend_network', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'data';
    });

    expect(result).toBe('data');
    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(1);

    const call = (ProfilerService.recordFrontendSpan as any).mock.calls[0][0];
    expect(call.name).toBe('async_fetch');
    expect(call.durationMs).toBeGreaterThanOrEqual(9);
  });

  it('should track parent in nested async operations', async () => {
    await profileAsync('outer_async', 'frontend_network', async () => {
      await profileAsync('inner_async', 'frontend_network', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });
    });

    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(2);

    const innerCall = (ProfilerService.recordFrontendSpan as any).mock.calls[0][0];
    expect(innerCall.parentId).toBeDefined();
  });

  it('should handle async errors and still record span', async () => {
    let errorThrown = false;

    try {
      await profileAsync('failing_operation', 'frontend_network', async () => {
        throw new Error('Simulated error');
      });
    } catch (e) {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);
    // Span should still be recorded even on error
    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(1);
  });
});

describe('FrontendProfiler - React Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create profiler callback for React components', () => {
    const callback = createProfilerCallback('MyComponent');
    expect(callback).toBeInstanceOf(Function);
  });

  it('should record mount phase', () => {
    const callback = createProfilerCallback('MyComponent');

    callback('MyComponent', 'mount', 15.5, 12.3, 100, 115.5);

    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(1);

    const call = (ProfilerService.recordFrontendSpan as any).mock.calls[0][0];
    expect(call.name).toBe('MyComponent:mount');
    expect(call.category).toBe('frontend_render');
    expect(call.durationMs).toBe(15.5);
  });

  it('should skip update and nested-update phases', () => {
    const callback = createProfilerCallback('MyComponent');

    callback('MyComponent', 'update', 5.0, 4.0, 100, 105);
    callback('MyComponent', 'nested-update', 3.0, 2.0, 110, 113);

    // Should not record update phases
    expect(ProfilerService.recordFrontendSpan).not.toHaveBeenCalled();
  });

  it('should include metadata in profiler callback', () => {
    const callback = createProfilerCallback('ExpensiveComponent');

    callback('ExpensiveComponent', 'mount', 45.2, 40.1, 200, 245.2);

    const call = (ProfilerService.recordFrontendSpan as any).mock.calls[0][0];
    expect(call.metadata).toBeDefined();
    expect(call.metadata).toEqual([
      ['phase', 'mount'],
      ['baseDuration', '40.10'],
      ['id', 'ExpensiveComponent'],
      ['renderTime', '45.20'],
      ['commitOverhead', '0.00'],
    ]);
  });
});

describe('FrontendProfiler - Interaction Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track user interactions', () => {
    trackInteraction('button_click', { buttonId: 'save-button' });

    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(1);

    const call = (ProfilerService.recordFrontendSpan as any).mock.calls[0][0];
    expect(call.name).toBe('button_click');
    expect(call.category).toBe('frontend_interaction');
    expect(call.durationMs).toBe(0); // Interactions are instant
    expect(call.metadata).toEqual([['buttonId', 'save-button']]);
  });

  it('should associate interactions with active spans', async () => {
    const span = startSpan('user_flow', 'frontend_interaction');

    trackInteraction('click_event');

    await span.end();

    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(2);

    const interactionCall = (ProfilerService.recordFrontendSpan as any).mock.calls[0][0];
    expect(interactionCall.parentId).toBe(span.id);
  });
});

describe('FrontendProfiler - Performance Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have minimal overhead for short operations', () => {
    const iterations = 1000;

    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      Math.sqrt(i);
    }
    const baselineEnd = performance.now();
    const baselineTime = baselineEnd - baselineStart;

    const profiledStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      profileSync('sqrt', 'frontend_render', () => {
        Math.sqrt(i);
      });
    }
    const profiledEnd = performance.now();
    const profiledTime = profiledEnd - profiledStart;

    const overhead = profiledTime - baselineTime;
    const overheadPerOp = overhead / iterations;

    // Overhead should be less than 0.1ms per operation
    expect(overheadPerOp).toBeLessThan(0.1);
  });

  it('should correctly handle rapid successive spans', async () => {
    const promises = [];

    for (let i = 0; i < 50; i++) {
      promises.push(
        profileAsync(`operation_${i}`, 'frontend_network', async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
        })
      );
    }

    await Promise.all(promises);

    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(50);
  });
});

describe('FrontendProfiler - Real-world Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should profile a complex user interaction flow', async () => {
    // Simulate: User clicks button -> Fetch data -> Process -> Render
    await profileAsync('user_saves_document', 'frontend_interaction', async () => {
      // Validate input
      profileSync('validate_form', 'frontend_render', () => {
        // Form validation logic
      });

      // Fetch from API
      await profileAsync('save_to_server', 'frontend_network', async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Update UI
      profileSync('update_ui', 'frontend_render', () => {
        // UI update logic
      });
    });

    // Should record 4 spans: main flow + 3 children
    expect(ProfilerService.recordFrontendSpan).toHaveBeenCalledTimes(4);

    // Verify hierarchy
    const calls = (ProfilerService.recordFrontendSpan as any).mock.calls;
    const mainSpan = calls[3][0];

    expect(mainSpan.name).toBe('user_saves_document');
    expect(mainSpan.parentId).toBeUndefined();

    // All children should have a parentId (the main span's ID)
    for (let i = 0; i < 3; i++) {
      expect(calls[i][0].parentId).toBeDefined();
      expect(typeof calls[i][0].parentId).toBe('string');
    }
  });

  it('should identify performance bottlenecks in nested operations', async () => {
    await profileAsync('load_dashboard', 'frontend_render', async () => {
      // Fast operation
      await profileAsync('load_user_info', 'frontend_network', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });

      // Slow operation (bottleneck)
      await profileAsync('load_large_dataset', 'frontend_network', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Fast operation
      await profileAsync('load_preferences', 'frontend_network', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });
    });

    const calls = (ProfilerService.recordFrontendSpan as any).mock.calls;

    // Find the bottleneck (excluding the parent load_dashboard span)
    const childCalls = calls.slice(0, 3); // First 3 are the network calls
    const slowestCall = childCalls.reduce((max: any, call: any) =>
      call[0].durationMs > (max[0]?.durationMs || 0) ? call : max
    );

    expect(slowestCall[0].name).toBe('load_large_dataset');
    expect(slowestCall[0].durationMs).toBeGreaterThanOrEqual(100);
  });
});
