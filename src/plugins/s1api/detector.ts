/**
 * S1API Project Detector
 * 
 * Detects S1API/MelonLoader mod projects by checking for:
 * - References to S1API.dll or S1API.Forked NuGet package in .csproj files
 * - MelonLoader references in project files
 * - Presence of classes inheriting from PhoneApp, Saveable, etc.
 */

import type { ProjectDetector, DetectedProject } from '@/lib/plugins/types';

/**
 * Patterns that indicate an S1API project
 */
const S1API_INDICATORS = {
    // NuGet package references
    nugetPackages: [
        'S1API',
        'S1API.Forked',
    ],
    // Assembly references
    assemblyRefs: [
        'S1API.dll',
        'S1API',
    ],
    // MelonLoader indicators
    melonLoader: [
        'MelonLoader',
        'MelonMod',
        'MelonPlugin',
    ],
    // S1API namespace patterns in code
    namespaces: [
        'S1API.PhoneApp',
        'S1API.Saveables',
        'S1API.PhoneCalls',
        'S1API.UI',
        'S1API.Internal',
    ],
    // Base class patterns
    baseClasses: [
        'PhoneApp',
        'Saveable',
        'PhoneCallDefinition',
    ],
};

/**
 * Check if a .csproj file contains S1API references
 */
async function checkCsprojForS1API(content: string): Promise<{ found: boolean; confidence: number }> {
    let confidence = 0;

    // Check for NuGet package references
    for (const pkg of S1API_INDICATORS.nugetPackages) {
        const pattern = new RegExp(`<PackageReference\\s+Include=["']${pkg}["']`, 'i');
        if (pattern.test(content)) {
            confidence += 0.5;
        }
    }

    // Check for assembly references
    for (const asm of S1API_INDICATORS.assemblyRefs) {
        const pattern = new RegExp(`<Reference\\s+Include=["']${asm}["']|<HintPath>.*${asm}`, 'i');
        if (pattern.test(content)) {
            confidence += 0.4;
        }
    }

    // Check for MelonLoader references
    for (const ml of S1API_INDICATORS.melonLoader) {
        const pattern = new RegExp(`<PackageReference\\s+Include=["']${ml}|<Reference\\s+Include=["']${ml}`, 'i');
        if (pattern.test(content)) {
            confidence += 0.2;
        }
    }

    return {
        found: confidence > 0,
        confidence: Math.min(confidence, 1.0),
    };
}

/**
 * Check if a C# file contains S1API usage patterns
 */
function checkCSharpForS1API(content: string): { found: boolean; confidence: number } {
    let confidence = 0;

    // Check for S1API using statements
    for (const ns of S1API_INDICATORS.namespaces) {
        const pattern = new RegExp(`using\\s+${ns.replace('.', '\\.')}`, 'i');
        if (pattern.test(content)) {
            confidence += 0.15;
        }
    }

    // Check for S1API base class inheritance
    for (const baseClass of S1API_INDICATORS.baseClasses) {
        const pattern = new RegExp(`:\\s*${baseClass}\\b`, 'i');
        if (pattern.test(content)) {
            confidence += 0.25;
        }
    }

    // Check for [SaveableField] attribute
    if (/\[SaveableField\s*\(/.test(content)) {
        confidence += 0.2;
    }

    // Check for UIFactory usage
    if (/UIFactory\.(Panel|Text|Button|Layout)/.test(content)) {
        confidence += 0.15;
    }

    return {
        found: confidence > 0,
        confidence: Math.min(confidence, 1.0),
    };
}

/**
 * S1API Project Detector
 */
export const s1apiProjectDetector: ProjectDetector = {
    id: 's1api-detector',
    projectType: 's1api',

    async detect(workspaceRoot: string): Promise<DetectedProject | null> {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const { join } = await import('@tauri-apps/api/path');
            const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');

            let totalConfidence = 0;
            let checksPerformed = 0;

            // Find and check .csproj files
            interface DirEntry {
                name: string;
                isFile: boolean;
                isDirectory: boolean;
            }

            const entries = await invoke<DirEntry[]>('list_directory_entries', {
                path: workspaceRoot,
            }).catch(() => [] as DirEntry[]);

            const csprojFiles = entries.filter(e => e.isFile && e.name.endsWith('.csproj'));

            for (const csproj of csprojFiles) {
                try {
                    const csprojPath = await join(workspaceRoot, csproj.name);
                    const content = await readTextFile(csprojPath);
                    const result = await checkCsprojForS1API(content);
                    if (result.found) {
                        totalConfidence += result.confidence;
                        checksPerformed++;
                    }
                } catch {
                    // Ignore read errors
                }
            }

            // Sample a few .cs files for S1API patterns
            const csFiles = entries.filter(e => e.isFile && e.name.endsWith('.cs')).slice(0, 5);

            for (const csFile of csFiles) {
                try {
                    const csPath = await join(workspaceRoot, csFile.name);
                    const content = await readTextFile(csPath);
                    const result = checkCSharpForS1API(content);
                    if (result.found) {
                        totalConfidence += result.confidence;
                        checksPerformed++;
                    }
                } catch {
                    // Ignore read errors
                }
            }

            // Check for common MelonLoader mod structure
            const melonModJson = await join(workspaceRoot, 'MelonInfo.cs');
            if (await exists(melonModJson)) {
                totalConfidence += 0.3;
                checksPerformed++;
            }

            // Calculate final confidence
            const finalConfidence = checksPerformed > 0 
                ? Math.min(totalConfidence / Math.max(checksPerformed, 1), 1.0)
                : 0;

            if (finalConfidence >= 0.3) {
                return {
                    type: 's1api',
                    name: 'S1API Mod Project',
                    confidence: finalConfidence,
                    metadata: {
                        csprojCount: csprojFiles.length,
                        hasS1APIRefs: totalConfidence > 0,
                    },
                };
            }

            return null;
        } catch (error) {
            console.error('[S1API Detector] Detection failed:', error);
            return null;
        }
    },
};

