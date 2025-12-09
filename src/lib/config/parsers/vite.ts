/**
 * Vite config parser
 *
 * Parses vite.config.ts/js files to extract dev server configuration
 * without executing the config file. Uses lightweight static analysis
 * to extract server port, HMR settings, and build output directory.
 */

import { readTextFile } from '@tauri-apps/plugin-fs';
import {
    DEFAULT_DEV_SERVER,
    DEFAULT_HMR,
    DEFAULT_BUILD,
    CONFIG_FILE_PATHS,
} from '../constants';
import type {
    ConfigResult,
    DevServerConfig,
    HmrConfig,
    BuildConfig,
} from '../schemas/metadata-types';
import { viteConfigSchema } from '../schemas/config-schema';

const DEFAULT_DEV_SERVER_CONFIG: DevServerConfig = {
    host: DEFAULT_DEV_SERVER.HOST,
    port: DEFAULT_DEV_SERVER.PORT,
    strictPort: DEFAULT_DEV_SERVER.STRICT_PORT,
    clearScreen: DEFAULT_DEV_SERVER.CLEAR_SCREEN,
};

const DEFAULT_HMR_CONFIG: HmrConfig = {
    enabled: DEFAULT_HMR.ENABLED,
    port: DEFAULT_HMR.PORT,
    protocol: DEFAULT_HMR.PROTOCOL,
};

const DEFAULT_BUILD_CONFIG: BuildConfig = {
    outDir: DEFAULT_BUILD.DIST_DIR,
};

/**
 * Extract numeric value from a config property
 * Handles patterns like: port: 1420, port:1420, port: 1420 (with optional comments)
 */
function extractNumber(
    content: string,
    property: string,
    defaultValue: number
): number {
    // Match: property: number or property:number (with optional whitespace/comments)
    const regex = new RegExp(
        `${property}\\s*:\\s*(?:/\\*[\\s\\S]*?\\*/|//[^\\n]*)*\\s*(\\d+)`,
        'i'
    );
    const match = content.match(regex);
    return match ? parseInt(match[1], 10) : defaultValue;
}

/**
 * Extract boolean value from a config property
 */
function extractBoolean(
    content: string,
    property: string,
    defaultValue: boolean
): boolean {
    const regex = new RegExp(`${property}\\s*:\\s*(true|false)`, 'i');
    const match = content.match(regex);
    if (match) {
        return match[1].toLowerCase() === 'true';
    }
    return defaultValue;
}

/**
 * Extract string value from a config property
 */
function extractString(
    content: string,
    property: string,
    defaultValue: string
): string {
    // Match: property: "value" or property: 'value' or property: `value`
    const regex = new RegExp(
        `${property}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`,
        'i'
    );
    const match = content.match(regex);
    return match ? match[1] : defaultValue;
}

/**
 * Extract a nested object block handling braces properly
 * Returns the content inside the braces, or null if not found
 */
function extractNestedBlock(content: string, property: string): string | null {
    const propertyRegex = new RegExp(`${property}\\s*:\\s*\\{`, 'i');
    const match = content.search(propertyRegex);
    if (match === -1) return null;

    let braceCount = 0;
    let start = match;
    let i = start;

    // Find the opening brace
    while (i < content.length && content[i] !== '{') i++;
    if (i >= content.length) return null;

    start = i;
    braceCount = 1;
    i++;

    // Find the matching closing brace
    while (i < content.length && braceCount > 0) {
        if (content[i] === '{') braceCount++;
        else if (content[i] === '}') braceCount--;
        i++;
    }

    if (braceCount !== 0) return null;

    // Extract content inside braces (excluding the braces themselves)
    return content.slice(start + 1, i - 1);
}

/**
 * Extract HMR configuration from server.hmr object
 */
function extractHmrConfig(content: string): HmrConfig {
    // Check if hmr is disabled: hmr: false
    if (content.match(/hmr\s*:\s*false/i)) {
        return { ...DEFAULT_HMR_CONFIG, enabled: false };
    }

    // Try to find hmr: { ... } block
    const hmrBlock = extractNestedBlock(content, 'hmr');
    if (!hmrBlock) {
        return DEFAULT_HMR_CONFIG;
    }

    const protocol = extractString(
        hmrBlock,
        'protocol',
        DEFAULT_HMR_CONFIG.protocol
    ) as 'ws' | 'wss';
    const port = extractNumber(hmrBlock, 'port', DEFAULT_HMR_CONFIG.port);
    const host = extractString(
        hmrBlock,
        'host',
        DEFAULT_DEV_SERVER.HOST
    );

    return {
        enabled: true,
        port,
        protocol: protocol === 'wss' ? 'wss' : 'ws',
        host,
    };
}

/**
 * Extract server configuration from vite config
 */
function extractServerConfig(content: string): DevServerConfig {
    // Try to find server: { ... } block
    const serverBlock = extractNestedBlock(content, 'server');
    if (!serverBlock) {
        return DEFAULT_DEV_SERVER_CONFIG;
    }

    const port = extractNumber(serverBlock, 'port', DEFAULT_DEV_SERVER.PORT);
    const strictPort = extractBoolean(
        serverBlock,
        'strictPort',
        DEFAULT_DEV_SERVER.STRICT_PORT
    );
    const host = extractString(serverBlock, 'host', DEFAULT_DEV_SERVER.HOST);
    const https = extractBoolean(serverBlock, 'https', false);
    const open = extractBoolean(serverBlock, 'open', false);
    const clearScreen = extractBoolean(
        content,
        'clearScreen',
        DEFAULT_DEV_SERVER.CLEAR_SCREEN
    );

    return {
        host: host === 'false' ? 'localhost' : host,
        port,
        strictPort,
        clearScreen,
        https,
        open,
    };
}

/**
 * Extract build configuration from vite config
 */
function extractBuildConfig(content: string): BuildConfig {
    // Try to find build: { ... } block
    const buildBlock = extractNestedBlock(content, 'build');
    if (!buildBlock) {
        return {
            outDir: DEFAULT_BUILD.DIST_DIR,
        };
    }
    const outDir = extractString(buildBlock, 'outDir', DEFAULT_BUILD.DIST_DIR);

    return {
        outDir,
    };
}

/**
 * Parse vite.config.ts or vite.config.js file
 */
export async function parseViteConfig(
    projectRoot: string
): Promise<ConfigResult<{ devServer: DevServerConfig; hmr: HmrConfig; build: BuildConfig }>> {
    const errors: string[] = [];

    // Try vite.config.ts first, then vite.config.js
    let configPath: string | null = null;
    let content: string | null = null;

    const pathsToTry = [
        `${projectRoot}/${CONFIG_FILE_PATHS.VITE}`,
        `${projectRoot}/${CONFIG_FILE_PATHS.VITE_JS}`,
    ];

    for (const path of pathsToTry) {
        try {
            content = await readTextFile(path);
            configPath = path;
            break;
        } catch {
            // File doesn't exist, try next
            continue;
        }
    }

    if (!content || !configPath) {
        // No vite config found, return defaults
        return {
            success: true,
            data: {
                devServer: DEFAULT_DEV_SERVER_CONFIG,
                hmr: DEFAULT_HMR_CONFIG,
                build: DEFAULT_BUILD_CONFIG,
            },
        };
    }

    try {
        // Extract configuration using static analysis
        const devServer = extractServerConfig(content);
        const hmr = extractHmrConfig(content);
        const build = extractBuildConfig(content);

        // Validate extracted data
        const validationResult = viteConfigSchema.safeParse({
            server: {
                port: devServer.port,
                host: devServer.host,
                strictPort: devServer.strictPort,
                https: devServer.https,
                open: devServer.open,
                hmr: hmr.enabled
                    ? {
                          protocol: hmr.protocol,
                          host: hmr.host,
                          port: hmr.port,
                      }
                    : false,
            },
            build: {
                outDir: build.outDir,
            },
            clearScreen: devServer.clearScreen,
        });

        if (!validationResult.success) {
            errors.push(
                `Validation failed: ${validationResult.error.message}`
            );
            // Still return extracted data even if validation fails
        }

        if (errors.length > 0) {
            return {
                success: false,
                errors,
            };
        }

        return {
            success: true,
            data: {
                devServer,
                hmr,
                build,
            },
        };
    } catch (error) {
        return {
            success: false,
            errors: [
                `Failed to parse vite config: ${error instanceof Error ? error.message : String(error)}`,
            ],
        };
    }
}

