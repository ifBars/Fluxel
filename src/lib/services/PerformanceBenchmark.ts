/**
 * Performance Benchmark Service
 * 
 * Provides utilities for running performance benchmarks on the Fluxel application.
 * These benchmarks run in the actual Tauri app environment to capture real performance data.
 * 
 * Usage:
 * 1. Open Fluxel in dev mode: `bun run tauri dev`
 * 2. Open the browser console (Ctrl+Shift+I -> Console)
 * 3. Run: `await window.__benchmarks.runAll()`
 * 
 * Or run individual benchmarks:
 * - `await window.__benchmarks.loadDirectory('C:/path/to/project')`
 * - `await window.__benchmarks.loadProject('C:/path/to/project')`
 */

import { useFileSystemStore } from '@/stores/editor/useFileSystemStore';
import { ProfilerService } from './ProfilerService';
import { FrontendProfiler } from './FrontendProfiler';

// =============================================================================
// Types
// =============================================================================

export interface BenchmarkResult {
    name: string;
    durationMs: number;
    iterations: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    stdDevMs: number;
    metadata: Record<string, string | number>;
}

export interface BenchmarkSuite {
    name: string;
    results: BenchmarkResult[];
    totalDurationMs: number;
    timestamp: string;
}

export interface BenchmarkOptions {
    iterations?: number;
    warmupIterations?: number;
    cooldownMs?: number;
    captureProfilingData?: boolean;
}

// =============================================================================
// Statistics Helpers
// =============================================================================

function calculateStats(times: number[]): { avg: number; min: number; max: number; stdDev: number } {
    if (times.length === 0) {
        return { avg: 0, min: 0, max: 0, stdDev: 0 };
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    const squaredDiffs = times.map(t => Math.pow(t - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    return { avg, min, max, stdDev };
}

// =============================================================================
// Core Benchmark Runner
// =============================================================================

async function runBenchmark(
    name: string,
    fn: () => Promise<Record<string, string | number>>,
    options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
    const {
        iterations = 5,
        warmupIterations = 1,
        cooldownMs = 100,
        captureProfilingData = true,
    } = options;

    console.log(`\n[Benchmark] Starting: ${name}`);
    console.log(`  Warmup iterations: ${warmupIterations}`);
    console.log(`  Measured iterations: ${iterations}`);

    // Warmup runs (not measured)
    for (let i = 0; i < warmupIterations; i++) {
        console.log(`  Warmup ${i + 1}/${warmupIterations}...`);
        await fn();
        await sleep(cooldownMs);
    }

    // Start profiling session if requested
    let sessionId: string | null = null;
    if (captureProfilingData) {
        sessionId = await ProfilerService.startSession(`benchmark:${name}`);
    }

    // Measured runs
    const times: number[] = [];
    let lastMetadata: Record<string, string | number> = {};

    for (let i = 0; i < iterations; i++) {
        console.log(`  Iteration ${i + 1}/${iterations}...`);
        
        const startTime = performance.now();
        lastMetadata = await fn();
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        await sleep(cooldownMs);
    }

    // End profiling session
    if (sessionId) {
        const report = await ProfilerService.endSession(sessionId);
        if (report) {
            console.log(`  Profiling captured ${report.session.spanCount} spans`);
        }
    }

    const stats = calculateStats(times);
    
    const result: BenchmarkResult = {
        name,
        durationMs: times.reduce((a, b) => a + b, 0),
        iterations,
        avgMs: stats.avg,
        minMs: stats.min,
        maxMs: stats.max,
        stdDevMs: stats.stdDev,
        metadata: lastMetadata,
    };

    console.log(`  Results:`);
    console.log(`    Average: ${stats.avg.toFixed(2)}ms`);
    console.log(`    Min: ${stats.min.toFixed(2)}ms`);
    console.log(`    Max: ${stats.max.toFixed(2)}ms`);
    console.log(`    Std Dev: ${stats.stdDev.toFixed(2)}ms`);

    return result;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Directory Loading Benchmark
// =============================================================================

/**
 * Benchmark loading a directory into the file system store.
 * This measures the performance of:
 * - Rust backend directory listing
 * - Gitignore processing
 * - FileEntry tree construction
 * - Zustand state updates
 */
export async function benchmarkLoadDirectory(
    path: string,
    options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
    const fileSystemStore = useFileSystemStore.getState();

    return runBenchmark(
        `loadDirectory(${path})`,
        async () => {
            // Clear the tree first to ensure a fresh load
            fileSystemStore.clearTree();
            
            // Wait a tick for React to process the clear
            await sleep(10);
            
            // Load the directory with profiling
            await FrontendProfiler.profileAsync('benchmark:loadDirectory', 'file_io', async () => {
                await fileSystemStore.loadDirectory(path);
            }, { path });

            // Get resulting tree stats
            const { rootEntry } = useFileSystemStore.getState();
            const stats = getTreeStats(rootEntry);
            
            return {
                totalEntries: stats.total,
                directories: stats.directories,
                files: stats.files,
                ignoredEntries: stats.ignored,
                maxDepth: stats.maxDepth,
            };
        },
        options
    );
}

// =============================================================================
// Folder Expansion Benchmark
// =============================================================================

/**
 * Benchmark expanding folders in the file tree.
 * This measures the lazy loading performance when users click on folders.
 */
export async function benchmarkFolderExpansion(
    rootPath: string,
    options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
    const fileSystemStore = useFileSystemStore.getState();

    // First, load the root directory
    fileSystemStore.clearTree();
    await fileSystemStore.loadDirectory(rootPath);
    
    // Find all expandable folders
    const { rootEntry } = useFileSystemStore.getState();
    const folders = findFolders(rootEntry);
    
    console.log(`  Found ${folders.length} folders to expand`);

    return runBenchmark(
        `expandFolders(${rootPath})`,
        async () => {
            // Collapse all folders first
            const currentState = useFileSystemStore.getState();
            for (const folder of folders) {
                if (currentState.expandedPaths.has(folder)) {
                    await currentState.toggleFolder(folder);
                }
            }
            await sleep(10);

            // Expand all folders with profiling
            let expandedCount = 0;
            await FrontendProfiler.profileAsync('benchmark:expandAllFolders', 'file_io', async () => {
                for (const folder of folders) {
                    const state = useFileSystemStore.getState();
                    if (!state.expandedPaths.has(folder)) {
                        await state.toggleFolder(folder);
                        expandedCount++;
                        // Small delay to let async loads complete
                        await sleep(5);
                    }
                }
            });

            return {
                foldersExpanded: expandedCount,
                totalFolders: folders.length,
            };
        },
        options
    );
}

// =============================================================================
// Full Project Load Benchmark
// =============================================================================

/**
 * Benchmark the full project loading flow.
 * This measures what happens when a user opens a new project.
 */
export async function benchmarkProjectLoad(
    projectPath: string,
    options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
    return runBenchmark(
        `fullProjectLoad(${projectPath})`,
        async () => {
            const fileSystemStore = useFileSystemStore.getState();
            
            // Clear everything
            fileSystemStore.clearTree();
            await sleep(10);

            // Profile the full project load
            const result = await FrontendProfiler.profileAsync(
                'benchmark:fullProjectLoad',
                'workspace',
                async () => {
                    // Load directory tree
                    await fileSystemStore.loadDirectory(projectPath);
                    
                    // Get tree stats
                    const { rootEntry } = useFileSystemStore.getState();
                    return getTreeStats(rootEntry);
                },
                { projectPath }
            );

            return {
                totalEntries: result.total,
                directories: result.directories,
                files: result.files,
                ignoredEntries: result.ignored,
                maxDepth: result.maxDepth,
            };
        },
        options
    );
}

// =============================================================================
// Tree Traversal Benchmark
// =============================================================================

/**
 * Benchmark tree traversal operations.
 * This measures operations like finding entries and refreshing status.
 */
export async function benchmarkTreeTraversal(
    rootPath: string,
    options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
    const fileSystemStore = useFileSystemStore.getState();

    // Ensure directory is loaded
    if (!fileSystemStore.rootEntry || fileSystemStore.rootPath !== rootPath) {
        await fileSystemStore.loadDirectory(rootPath);
    }

    return runBenchmark(
        `treeTraversal(${rootPath})`,
        async () => {
            const { rootEntry } = useFileSystemStore.getState();
            
            let traversalCount = 0;
            
            await FrontendProfiler.profileAsync('benchmark:treeTraversal', 'file_io', async () => {
                // Traverse entire tree
                const traverse = (entry: typeof rootEntry): number => {
                    if (!entry) return 0;
                    let count = 1;
                    if (entry.children) {
                        for (const child of entry.children) {
                            count += traverse(child);
                        }
                    }
                    return count;
                };
                
                // Traverse multiple times to get meaningful measurements
                for (let i = 0; i < 100; i++) {
                    traversalCount = traverse(rootEntry);
                }
            });

            return {
                nodesTraversed: traversalCount,
                traversalIterations: 100,
            };
        },
        options
    );
}

// =============================================================================
// Helper Functions
// =============================================================================

interface TreeStats {
    total: number;
    directories: number;
    files: number;
    ignored: number;
    maxDepth: number;
}

function getTreeStats(entry: ReturnType<typeof useFileSystemStore.getState>['rootEntry'], depth = 0): TreeStats {
    if (!entry) {
        return { total: 0, directories: 0, files: 0, ignored: 0, maxDepth: 0 };
    }

    let stats: TreeStats = {
        total: 1,
        directories: entry.isDirectory ? 1 : 0,
        files: entry.isDirectory ? 0 : 1,
        ignored: entry.isIgnored ? 1 : 0,
        maxDepth: depth,
    };

    if (entry.children) {
        for (const child of entry.children) {
            const childStats = getTreeStats(child, depth + 1);
            stats.total += childStats.total;
            stats.directories += childStats.directories;
            stats.files += childStats.files;
            stats.ignored += childStats.ignored;
            stats.maxDepth = Math.max(stats.maxDepth, childStats.maxDepth);
        }
    }

    return stats;
}

function findFolders(entry: ReturnType<typeof useFileSystemStore.getState>['rootEntry']): string[] {
    if (!entry) return [];
    
    const folders: string[] = [];
    
    const traverse = (e: NonNullable<typeof entry>) => {
        if (e.isDirectory && e.path !== entry?.path) {
            folders.push(e.path);
        }
        if (e.children) {
            for (const child of e.children) {
                traverse(child);
            }
        }
    };
    
    traverse(entry);
    return folders;
}

// =============================================================================
// Benchmark Suite Runner
// =============================================================================

/**
 * Run all benchmarks for a given project path.
 */
export async function runAllBenchmarks(
    projectPath: string,
    options: BenchmarkOptions = {}
): Promise<BenchmarkSuite> {
    const startTime = performance.now();
    const results: BenchmarkResult[] = [];

    console.log('='.repeat(60));
    console.log('FLUXEL PERFORMANCE BENCHMARK SUITE');
    console.log('='.repeat(60));
    console.log(`Project: ${projectPath}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    // Clear profiler before starting
    await ProfilerService.clear();

    // Run benchmarks
    results.push(await benchmarkLoadDirectory(projectPath, options));
    results.push(await benchmarkFolderExpansion(projectPath, options));
    results.push(await benchmarkProjectLoad(projectPath, options));
    results.push(await benchmarkTreeTraversal(projectPath, options));

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    
    for (const result of results) {
        console.log(`\n${result.name}:`);
        console.log(`  Avg: ${result.avgMs.toFixed(2)}ms`);
        console.log(`  Min: ${result.minMs.toFixed(2)}ms | Max: ${result.maxMs.toFixed(2)}ms`);
        console.log(`  Std Dev: ${result.stdDevMs.toFixed(2)}ms`);
        if (Object.keys(result.metadata).length > 0) {
            console.log(`  Metadata:`, result.metadata);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Total suite duration: ${totalDuration.toFixed(2)}ms`);
    console.log('='.repeat(60));

    return {
        name: 'Fluxel Performance Suite',
        results,
        totalDurationMs: totalDuration,
        timestamp: new Date().toISOString(),
    };
}

// =============================================================================
// Benchmark Comparison & Regression Detection
// =============================================================================

export interface BenchmarkComparison {
    name: string;
    baseline: BenchmarkResult;
    current: BenchmarkResult;
    changePercent: number;
    isRegression: boolean;
    isImprovement: boolean;
}

export interface SuiteComparison {
    timestamp: string;
    baselineTimestamp: string;
    comparisons: BenchmarkComparison[];
    overallChangePercent: number;
    regressions: string[];
    improvements: string[];
}

/**
 * Compare two benchmark results and detect regressions.
 * A regression is when the current result is >10% slower than baseline.
 * An improvement is when the current result is >10% faster than baseline.
 */
function compareResults(baseline: BenchmarkResult, current: BenchmarkResult): BenchmarkComparison {
    const changePercent = ((current.avgMs - baseline.avgMs) / baseline.avgMs) * 100;
    
    return {
        name: baseline.name,
        baseline,
        current,
        changePercent,
        isRegression: changePercent > 10,
        isImprovement: changePercent < -10,
    };
}

/**
 * Compare two benchmark suites and report regressions/improvements.
 */
export function compareSuites(baseline: BenchmarkSuite, current: BenchmarkSuite): SuiteComparison {
    const comparisons: BenchmarkComparison[] = [];
    const regressions: string[] = [];
    const improvements: string[] = [];

    for (const currentResult of current.results) {
        const baselineResult = baseline.results.find(r => r.name === currentResult.name);
        if (baselineResult) {
            const comparison = compareResults(baselineResult, currentResult);
            comparisons.push(comparison);
            
            if (comparison.isRegression) {
                regressions.push(`${comparison.name}: ${comparison.changePercent.toFixed(1)}% slower`);
            }
            if (comparison.isImprovement) {
                improvements.push(`${comparison.name}: ${Math.abs(comparison.changePercent).toFixed(1)}% faster`);
            }
        }
    }

    const overallChangePercent = comparisons.length > 0
        ? comparisons.reduce((sum, c) => sum + c.changePercent, 0) / comparisons.length
        : 0;

    return {
        timestamp: current.timestamp,
        baselineTimestamp: baseline.timestamp,
        comparisons,
        overallChangePercent,
        regressions,
        improvements,
    };
}

/**
 * Print a formatted comparison report to the console.
 */
export function printComparisonReport(comparison: SuiteComparison): void {
    console.log('\n' + '='.repeat(70));
    console.log('BENCHMARK COMPARISON REPORT');
    console.log('='.repeat(70));
    console.log(`Baseline: ${comparison.baselineTimestamp}`);
    console.log(`Current:  ${comparison.timestamp}`);
    console.log('='.repeat(70));

    for (const c of comparison.comparisons) {
        const arrow = c.isRegression ? '🔴 ↑' : c.isImprovement ? '🟢 ↓' : '⚪ →';
        const sign = c.changePercent >= 0 ? '+' : '';
        console.log(`\n${arrow} ${c.name}`);
        console.log(`   Baseline: ${c.baseline.avgMs.toFixed(2)}ms`);
        console.log(`   Current:  ${c.current.avgMs.toFixed(2)}ms`);
        console.log(`   Change:   ${sign}${c.changePercent.toFixed(1)}%`);
    }

    console.log('\n' + '-'.repeat(70));
    console.log('SUMMARY');
    console.log('-'.repeat(70));
    
    if (comparison.regressions.length > 0) {
        console.log('\n🔴 REGRESSIONS:');
        comparison.regressions.forEach(r => console.log(`   - ${r}`));
    }
    
    if (comparison.improvements.length > 0) {
        console.log('\n🟢 IMPROVEMENTS:');
        comparison.improvements.forEach(i => console.log(`   - ${i}`));
    }

    if (comparison.regressions.length === 0 && comparison.improvements.length === 0) {
        console.log('\n⚪ No significant changes detected (within ±10%)');
    }

    const sign = comparison.overallChangePercent >= 0 ? '+' : '';
    console.log(`\nOverall change: ${sign}${comparison.overallChangePercent.toFixed(1)}%`);
    console.log('='.repeat(70));
}

// =============================================================================
// Baseline Storage (localStorage for persistence between sessions)
// =============================================================================

const BASELINE_STORAGE_KEY = 'fluxel_benchmark_baseline';

/**
 * Save a benchmark suite as the baseline for future comparisons.
 */
export function saveBaseline(suite: BenchmarkSuite): void {
    try {
        localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(suite));
        console.log(`[Benchmark] Baseline saved: ${suite.timestamp}`);
    } catch (e) {
        console.error('[Benchmark] Failed to save baseline:', e);
    }
}

/**
 * Load the saved baseline benchmark suite.
 */
export function loadBaseline(): BenchmarkSuite | null {
    try {
        const stored = localStorage.getItem(BASELINE_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored) as BenchmarkSuite;
        }
    } catch (e) {
        console.error('[Benchmark] Failed to load baseline:', e);
    }
    return null;
}

/**
 * Clear the saved baseline.
 */
export function clearBaseline(): void {
    localStorage.removeItem(BASELINE_STORAGE_KEY);
    console.log('[Benchmark] Baseline cleared');
}

/**
 * Run benchmarks and compare against the saved baseline.
 */
export async function runAndCompare(
    projectPath: string,
    options: BenchmarkOptions = {}
): Promise<{ suite: BenchmarkSuite; comparison: SuiteComparison | null }> {
    const baseline = loadBaseline();
    const suite = await runAllBenchmarks(projectPath, options);
    
    let comparison: SuiteComparison | null = null;
    
    if (baseline) {
        comparison = compareSuites(baseline, suite);
        printComparisonReport(comparison);
    } else {
        console.log('\n[Benchmark] No baseline found. Run saveBaseline() to set the current results as baseline.');
    }

    return { suite, comparison };
}

// =============================================================================
// Pre-configured Benchmark for MLVScan
// =============================================================================

const MLVSCAN_PATH = 'C:/Users/ghost/Desktop/Coding/ScheduleOne/MLVScan';

export async function runMLVScanBenchmarks(options: BenchmarkOptions = {}): Promise<BenchmarkSuite> {
    return runAllBenchmarks(MLVSCAN_PATH, options);
}

// =============================================================================
// Export for Global Access (Dev Mode)
// =============================================================================

/**
 * Expose benchmarks globally for easy access from the browser console.
 * Usage: await window.__benchmarks.runAll()
 */
export function registerGlobalBenchmarks(): void {
    if (typeof window !== 'undefined') {
        (window as any).__benchmarks = {
            loadDirectory: benchmarkLoadDirectory,
            folderExpansion: benchmarkFolderExpansion,
            projectLoad: benchmarkProjectLoad,
            treeTraversal: benchmarkTreeTraversal,
            runAll: runAllBenchmarks,
            runMLVScan: runMLVScanBenchmarks,
            
            // Comparison utilities
            compare: {
                run: runAndCompare,
                suites: compareSuites,
                print: printComparisonReport,
            },
            
            // Baseline management
            baseline: {
                save: saveBaseline,
                load: loadBaseline,
                clear: clearBaseline,
                saveCurrentAsBaseline: async (path: string = MLVSCAN_PATH) => {
                    const suite = await runAllBenchmarks(path, { iterations: 5 });
                    saveBaseline(suite);
                    return suite;
                },
            },
            
            // Quick shortcuts
            quick: {
                mlvscan: () => runMLVScanBenchmarks({ iterations: 3, warmupIterations: 1 }),
                full: () => runMLVScanBenchmarks({ iterations: 10, warmupIterations: 2 }),
                compare: () => runAndCompare(MLVSCAN_PATH, { iterations: 5 }),
            },
            
            // Help
            help: () => {
                console.log(`
Fluxel Performance Benchmarks
==============================

Available benchmarks:
  __benchmarks.loadDirectory(path)    - Benchmark directory loading
  __benchmarks.folderExpansion(path)  - Benchmark folder expansion
  __benchmarks.projectLoad(path)      - Benchmark full project load
  __benchmarks.treeTraversal(path)    - Benchmark tree traversal
  __benchmarks.runAll(path)           - Run all benchmarks

Quick shortcuts:
  __benchmarks.quick.mlvscan()        - Quick MLVScan benchmark (3 iterations)
  __benchmarks.quick.full()           - Full MLVScan benchmark (10 iterations)
  __benchmarks.quick.compare()        - Run and compare against baseline
  __benchmarks.runMLVScan()           - Run benchmarks on MLVScan project

Baseline management:
  __benchmarks.baseline.save(suite)             - Save a suite as baseline
  __benchmarks.baseline.load()                  - Load saved baseline
  __benchmarks.baseline.clear()                 - Clear saved baseline
  __benchmarks.baseline.saveCurrentAsBaseline() - Run and save as baseline

Comparison:
  __benchmarks.compare.run(path)      - Run benchmarks and compare to baseline
  __benchmarks.compare.suites(a, b)   - Compare two suites
  __benchmarks.compare.print(comp)    - Print comparison report

Options (all benchmarks accept these):
  {
    iterations: 5,           // Number of measured runs
    warmupIterations: 1,     // Number of warmup runs (not measured)
    cooldownMs: 100,         // Delay between iterations
    captureProfilingData: true  // Whether to capture profiling spans
  }

Workflow for performance optimization:
  1. __benchmarks.baseline.saveCurrentAsBaseline()  // Set initial baseline
  2. Make code changes
  3. __benchmarks.quick.compare()                   // See if you improved/regressed

Example:
  await __benchmarks.loadDirectory('C:/my/project', { iterations: 10 })
                `);
            },
        };

        console.log('[PerformanceBenchmark] Benchmarks registered. Run __benchmarks.help() for usage.');
    }
}

// =============================================================================
// Default Export
// =============================================================================

export const PerformanceBenchmark = {
    // Individual benchmarks
    benchmarkLoadDirectory,
    benchmarkFolderExpansion,
    benchmarkProjectLoad,
    benchmarkTreeTraversal,
    
    // Suite runners
    runAllBenchmarks,
    runMLVScanBenchmarks,
    
    // Comparison utilities
    compareSuites,
    printComparisonReport,
    runAndCompare,
    
    // Baseline management
    saveBaseline,
    loadBaseline,
    clearBaseline,
    
    // Registration
    registerGlobalBenchmarks,
};

export default PerformanceBenchmark;
