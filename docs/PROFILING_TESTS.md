# Profiling Test Suite

This document describes the comprehensive test suite for Fluxel's profiling infrastructure, which validates hierarchical span tracking, parent-child relationships, and performance attribution.

## Overview

The profiling system now includes:
- **Parent-child span relationships** - Full hierarchical tracking like dotTrace
- **Self-time vs total-time attribution** - Identify where CPU actually executes code
- **Flame graph visualization** - Visual representation of the call hierarchy
- **Automated tests** - 26 total tests (7 Rust + 19 TypeScript)

## Running the Tests

### Backend (Rust) Tests

```bash
cd src-tauri
cargo test --features profiling profiling::attribution
```

**Test Coverage:**
- ✅ Self-time calculation accuracy
- ✅ Nested hierarchy tracking (4+ levels deep)
- ✅ Critical path identification
- ✅ Hotspot detection by self-time
- ✅ Category breakdown with self-time
- ✅ Performance with large trees (111 spans)

### Frontend (TypeScript) Tests

```bash
bun test
# or
bun test:run     # Run once
bun test:ui      # Interactive UI
bun test:coverage # With coverage report
```

**Test Coverage:**
- ✅ Parent-child relationship tracking in nested spans
- ✅ Deep nesting (3+ levels)
- ✅ Sibling span handling
- ✅ Synchronous operation profiling
- ✅ Asynchronous operation profiling
- ✅ React component integration
- ✅ User interaction tracking
- ✅ Performance overhead validation
- ✅ Real-world scenario testing

## Test Results Summary

### Backend Tests (7/7 passing)

All Rust tests pass in < 1ms, demonstrating:

1. **Accurate Self-Time Calculation**
   - Root span: 100ms total, 10ms self-time (100 - 60 - 30)
   - Correctly subtracts children time from parent time

2. **Deep Hierarchy Support**
   - 4-level deep trees tracked correctly
   - Each level maintains proper depth and parent references

3. **Critical Path Analysis**
   - Identifies the longest sequential chain through the call tree
   - Correctly follows the slowest child at each level

4. **Hotspot Detection**
   - Ranks spans by self-time (not total time)
   - Filters out spans < 0.1ms to focus on real bottlenecks

5. **Category Attribution**
   - Groups spans by category with accurate self-time totals
   - FileIo category: 2 spans, 50ms combined self-time

6. **Performance at Scale**
   - 111-span tree analyzed in < 50ms
   - O(n) complexity validated

### Frontend Tests (19/19 passing)

All TypeScript tests pass, validating:

1. **Parent-Child Tracking**
   - Nested spans correctly reference parent IDs
   - Sibling spans share the same parent
   - Deep nesting (3+ levels) maintains hierarchy

2. **Timing Accuracy**
   - Synchronous operations captured with <1ms accuracy
   - Asynchronous operations tracked correctly
   - Error handling doesn't break span recording

3. **React Integration**
   - Profiler callbacks work with React.Profiler
   - Mount phases recorded, updates skipped (reduces noise)
   - Metadata properly attached

4. **Performance**
   - Overhead < 0.1ms per operation
   - 50 concurrent async operations handled correctly

5. **Real-World Scenarios**
   - Complex user flows (validate → fetch → render) tracked
   - Bottlenecks correctly identified (100ms slow operation found)

## Key Insights from Tests

### What Makes a Good Profiling System

The tests validate these critical features:

1. **Hierarchical Attribution** ✅
   - Not just "which function took the longest"
   - But "where in the call stack is CPU time actually spent"
   - Self-time shows where code executes, not waits for children

2. **Accuracy Over Speed** ✅
   - Self-time calculations are precise to 0.01ms
   - Parent-child relationships never break
   - Critical paths always represent the actual longest chain

3. **Performance** ✅
   - Minimal overhead (<0.1ms per span)
   - Scales to hundreds of spans without slowdown
   - Analysis completes in milliseconds

4. **Usability** ✅
   - Automatic parent tracking (no manual linking)
   - Works with both sync and async code
   - Integrates seamlessly with React

### Performance Optimization Workflow

The tests demonstrate this workflow:

```typescript
// 1. Profile a slow operation
await profileAsync('user_saves_document', 'frontend_interaction', async () => {
  profileSync('validate_form', 'frontend_render', () => { });
  await profileAsync('save_to_server', 'frontend_network', async () => { });
  profileSync('update_ui', 'frontend_render', () => { });
});

// 2. View in flame graph to see hierarchy
// 3. Check hotspots to find high self-time functions
// 4. Look at category breakdown to see where time goes
// 5. Follow critical path to understand slowest sequence
```

## Example Test Output

### Rust Test Output
```
running 7 tests
test profiling::attribution::comprehensive_tests::test_hotspot_detection ... ok
test profiling::attribution::comprehensive_tests::test_self_time_calculation ... ok
test profiling::attribution::basic_tests::test_attribution_basic ... ok
test profiling::attribution::comprehensive_tests::test_category_breakdown ... ok
test profiling::attribution::comprehensive_tests::test_nested_hierarchy ... ok
test profiling::attribution::comprehensive_tests::test_critical_path_identification ... ok
test profiling::attribution::comprehensive_tests::test_performance_with_large_tree ... ok

test result: ok. 7 passed; 0 failed; 0 ignored
```

### Frontend Test Output
```
✓ should track parent-child relationship in nested spans (2ms)
✓ should handle deeply nested spans (3+ levels)
✓ should profile synchronous operations (1ms)
✓ should capture duration for synchronous operations (10ms)
✓ should profile async operations (12ms)
✓ should handle async errors and still record span (1ms)
✓ should record mount phase
✓ should have minimal overhead for short operations (2ms)
✓ should profile a complex user interaction flow (30ms)
✓ should identify performance bottlenecks in nested operations (135ms)

Test Files  1 passed (1)
Tests  19 passed (19)
```

## Continuous Integration

Add to CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Test Rust profiling
  run: cd src-tauri && cargo test --features profiling

- name: Test TypeScript profiling
  run: bun test:run
```

## Future Enhancements

Potential additions to the test suite:

1. **Memory Profiling**
   - Track allocations per span
   - Detect memory leaks in long-running operations

2. **Concurrency Testing**
   - Validate correct behavior with parallel spans
   - Test race conditions in span stack management

3. **Integration Tests**
   - End-to-end tests through Tauri IPC
   - Verify frontend spans reach backend storage

4. **Regression Tests**
   - Benchmark critical operations
   - Alert on performance degradations > 10%

## Debugging Failed Tests

### Rust Tests

If a test fails:
```bash
# Run with detailed output
cd src-tauri
cargo test --features profiling -- --nocapture

# Run specific test
cargo test --features profiling test_self_time_calculation
```

### TypeScript Tests

If a test fails:
```bash
# Run with detailed output
bun test -- --reporter=verbose

# Run specific test
bun test -- -t "should track parent-child"

# Debug in UI mode
bun test:ui
```

## Contributing

When adding new profiling features:

1. Write tests first (TDD)
2. Ensure 100% test coverage for core logic
3. Add performance benchmarks
4. Update this README with new test categories
5. Run full suite before submitting PR

## Summary

This test suite ensures that Fluxel's profiling system provides:
- **Accurate attribution** - Know exactly where time is spent
- **Hierarchical insights** - See parent-child relationships
- **Performance** - Minimal overhead, fast analysis
- **Reliability** - All critical paths tested

Run tests frequently during development to catch regressions early!
