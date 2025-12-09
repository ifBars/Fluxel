import ignore, { type Ignore } from 'ignore';
import { readTextFile } from '@tauri-apps/plugin-fs';

/**
 * Normalize path separators and trim trailing slashes (except for root-like paths).
 */
function normalizePath(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    if (normalized === '/') return normalized;
    return normalized.replace(/\/+$/, '');
}

/**
 * Get directory name for a normalized path.
 */
function dirname(path: string): string {
    const normalized = normalizePath(path);
    const parts = normalized.split('/');
    parts.pop();
    return parts.join('/') || normalized;
}

/**
 * Parse .gitignore content into raw patterns.
 */
function parseGitignoreContent(content: string): string[] {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * GitignoreManager caches patterns per directory and can answer whether a path is ignored,
 * honoring stacked .gitignore files with negation support.
 */
export class GitignoreManager {
    private readonly rootPath: string;
    private patternCache = new Map<string, string[]>();
    private matcherCache = new Map<string, Ignore>();

    constructor(rootPath: string) {
        this.rootPath = normalizePath(rootPath);
    }

    /**
     * Clear cached matchers and patterns (useful if .gitignore files change).
     */
    reset() {
        this.patternCache.clear();
        this.matcherCache.clear();
    }

    /**
     * Determine whether the given absolute path is ignored.
     */
    async isIgnored(absolutePath: string, isDirectory: boolean): Promise<boolean> {
        const normalized = normalizePath(absolutePath);
        const relativePath = this.relativePathFromRoot(normalized);

        if (!relativePath) {
            // Root itself is never considered ignored
            return false;
        }

        // For directories, we only need matchers up to the parent directory.
        const parentDir = isDirectory ? dirname(normalized) : dirname(normalized);
        const matcher = await this.buildMatcherForDir(parentDir);

        const candidate = isDirectory ? `${relativePath}/` : relativePath;
        return matcher.ignores(candidate);
    }

    /**
     * Build (or retrieve) a matcher that includes all patterns up to the provided directory.
     */
    private async buildMatcherForDir(dirPath: string): Promise<Ignore> {
        const normalizedDir = normalizePath(dirPath);
        const cached = this.matcherCache.get(normalizedDir);
        if (cached) return cached;

        const matcher = ignore();
        const ancestors = this.getAncestorDirs(normalizedDir);

        for (const ancestor of ancestors) {
            const patterns = await this.loadPatternsForDir(ancestor);
            if (!patterns.length) continue;

            const ancestorRel = this.relativeDirFromRoot(ancestor);
            const prefixed = patterns.map((pattern) =>
                this.prefixPattern(pattern, ancestorRel)
            );

            matcher.add(prefixed);
        }

        this.matcherCache.set(normalizedDir, matcher);
        return matcher;
    }

    /**
     * Load and cache patterns for a specific directory's .gitignore.
     */
    private async loadPatternsForDir(dirPath: string): Promise<string[]> {
        const normalizedDir = normalizePath(dirPath);
        const cached = this.patternCache.get(normalizedDir);
        if (cached) return cached;

        const gitignorePath = `${normalizedDir}/.gitignore`;
        try {
            const content = await readTextFile(gitignorePath);
            const patterns = parseGitignoreContent(content);
            this.patternCache.set(normalizedDir, patterns);
            return patterns;
        } catch {
            // Missing or unreadable .gitignore; treat as no patterns.
            this.patternCache.set(normalizedDir, []);
            return [];
        }
    }

    /**
     * Get all ancestor directories from root to the provided directory (inclusive).
     */
    private getAncestorDirs(dirPath: string): string[] {
        const dirs: string[] = [];
        const normalizedDir = normalizePath(dirPath);
        const root = this.rootPath;

        if (!normalizedDir.startsWith(root)) {
            return [root];
        }

        const relative = this.relativeDirFromRoot(normalizedDir);
        const parts = relative ? relative.split('/').filter(Boolean) : [];

        let current = root;
        dirs.push(root);

        for (const part of parts) {
            current = `${current}/${part}`;
            dirs.push(current);
        }

        return dirs;
    }

    /**
     * Convert a pattern defined within a directory to a root-anchored pattern that preserves scope.
     */
    private prefixPattern(pattern: string, dirRelative: string): string {
        const isNegated = pattern.startsWith('!');
        const body = isNegated ? pattern.slice(1) : pattern;
        const base = dirRelative || '';

        let adjusted: string;
        if (!base) {
            adjusted = body;
        } else if (body.startsWith('/')) {
            adjusted = `${base}${body}`;
        } else {
            adjusted = `${base}/${body}`;
        }

        return isNegated ? `!${adjusted}` : adjusted;
    }

    /**
     * Relative path from root ('' if equal).
     */
    private relativePathFromRoot(path: string): string {
        const normalized = normalizePath(path);
        if (normalized === this.rootPath) return '';
        if (normalized.startsWith(`${this.rootPath}/`)) {
            return normalized.slice(this.rootPath.length + 1);
        }
        return normalized;
    }

    /**
     * Relative directory from root ('' if root).
     */
    private relativeDirFromRoot(dirPath: string): string {
        const normalized = normalizePath(dirPath);
        if (normalized === this.rootPath) return '';
        if (normalized.startsWith(`${this.rootPath}/`)) {
            return normalized.slice(this.rootPath.length + 1);
        }
        return normalized;
    }
}

