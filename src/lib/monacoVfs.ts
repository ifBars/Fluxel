import { readTextFile } from "@tauri-apps/plugin-fs";
import type * as Monaco from "monaco-editor";
import { discoverTypingsForPackages } from "./nodeResolverService";
import { normalizePath } from "./monacoTypeLoader";

type MonacoInstance = typeof Monaco;

export class MonacoVfs {
    private models = new Map<string, Monaco.editor.ITextModel>();
    private extraLibUris = new Set<string>();

    constructor(private monaco: MonacoInstance) { }


    async createOrUpdateModel(path: string, languageHint?: string): Promise<void> {
        const normalizedPath = normalizePath(path);
        const uri = this.monaco.Uri.file(normalizedPath);
        const uriString = uri.toString();

        const existing = this.monaco.editor.getModel(uri);
        const content = await readTextFile(normalizedPath);
        const language = languageHint ?? this.detectLanguage(path);

        // DIAGNOSTIC: Log first few model creations
        if (this.models.size < 3 || this.models.size % 20 === 0) {
            console.log(`[DIAGNOSTIC VFS] Creating model #${this.models.size + 1}:`, {
                path,
                uri: uriString,
                language,
                contentLength: content.length
            });
        }

        if (existing) {
            existing.setValue(content);
            this.models.set(uriString, existing);
            return;
        }

        const model = this.monaco.editor.createModel(content, language, uri);
        this.models.set(uriString, model);
    }

    async addExtraLib(path: string): Promise<void> {
        const normalized = normalizePath(path);

        // Convert to virtual node_modules path for Monaco module resolution
        const nodeModulesIndex = normalized.lastIndexOf('node_modules/');
        let uri: string;
        if (nodeModulesIndex !== -1) {
            // Use virtual path like file:///node_modules/package/index.d.ts
            uri = `file:///${normalized.slice(nodeModulesIndex)}`;
        } else {
            // Fallback to normalized path for non-node_modules files
            uri = `file:///${normalized}`;
        }

        if (this.extraLibUris.has(uri)) return;
        const content = await readTextFile(normalized);
        this.monaco.typescript.typescriptDefaults.addExtraLib(content, uri);
        this.extraLibUris.add(uri);
    }


    async hydrateTypings(packageNames: string[], projectRoot: string): Promise<void> {
        if (packageNames.length === 0) return;
        const responses = await discoverTypingsForPackages(packageNames, projectRoot);
        for (const res of responses) {
            for (const file of res.files) {
                try {
                    await this.addExtraLib(file);
                } catch (error) {
                    console.warn("[MonacoVfs] Failed to add typings", res.package_name, error);
                }
            }
        }
    }

    clear(): void {
        for (const [, model] of this.models) {
            try {
                if (!model.isDisposed()) model.dispose();
            } catch (error) {
                console.warn("[MonacoVfs] Failed to dispose model", error);
            }
        }
        this.models.clear();
        this.extraLibUris.clear();
    }

    private detectLanguage(filePath: string): string {
        const ext = filePath.split(".").pop()?.toLowerCase();
        switch (ext) {
            case "ts":
            case "tsx":
                return "typescript";
            case "js":
            case "jsx":
                return "javascript";
            case "json":
                return "json";
            default:
                return "plaintext";
        }
    }
}
