export function normalizeFsPath(path: string): string {
    return path.replace(/\\/g, "/");
}

function isWindowsDrivePath(path: string): boolean {
    return /^[A-Za-z]:\//.test(path);
}

/**
 * Convert a filesystem path to a standard LSP file URI.
 * Uses `file:///C:/...` on Windows (colon not percent-encoded).
 */
export function fsPathToLspUri(path: string): string {
    const normalized = normalizeFsPath(path);
    const driveMatch = normalized.match(/^([A-Za-z]):(\/.*)?$/);
    if (driveMatch) {
        const driveLetter = driveMatch[1].toUpperCase();
        const rest = normalized.slice(2); // includes leading "/"
        return `file:///${driveLetter}:${rest}`;
    }

    if (normalized.startsWith("/")) {
        return `file://${normalized}`;
    }

    return `file:///${normalized}`;
}

/**
 * Convert a filesystem path to Monaco's `Uri.file(...).toString()` format.
 * Uses `file:///c%3A/...` on Windows (lowercase drive letter, encoded colon).
 */
export function fsPathToMonacoUri(path: string): string {
    const normalized = normalizeFsPath(path);
    const driveMatch = normalized.match(/^([A-Za-z]):(\/.*)?$/);
    if (driveMatch) {
        const driveLetter = driveMatch[1].toLowerCase();
        const rest = normalized.slice(2);
        return `file:///${driveLetter}%3A${rest}`;
    }

    if (normalized.startsWith("/")) {
        return `file:///${normalized.slice(1)}`;
    }

    return `file:///${normalized}`;
}

/**
 * Convert a file URI (`file://...`) to a normalized filesystem path (forward slashes).
 * Decodes percent-encoding and preserves Windows drive letters.
 */
export function fileUriToFsPath(uriOrPath: string): string {
    if (!uriOrPath.startsWith("file://")) {
        return normalizeFsPath(uriOrPath);
    }

    // Remove scheme and leading slashes (handles file:///...).
    let rest = uriOrPath.replace(/^file:\/+/, "");
    rest = decodeURIComponent(rest);

    // Windows: "C:/path"
    if (isWindowsDrivePath(rest)) {
        const driveLetter = rest[0]?.toUpperCase() ?? "C";
        return `${driveLetter}${rest.slice(1)}`;
    }

    // Unix: ensure leading "/"
    return `/${rest}`;
}

export function lspUriToMonacoUri(uri: string): string {
    return fsPathToMonacoUri(fileUriToFsPath(uri));
}

export function monacoUriToLspUri(uri: string): string {
    return fsPathToLspUri(fileUriToFsPath(uri));
}

