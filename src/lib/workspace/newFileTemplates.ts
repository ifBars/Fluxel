import { getPluginHost } from '@/lib/plugins';
import type {
    NewFileTemplate,
    NewFileTemplateBuildArgs,
    NewFileTemplateContext,
} from '@/lib/plugins/types';

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}

function stripExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

function capitalize(value: string): string {
    if (!value) {
        return '';
    }

    return value[0].toUpperCase() + value.slice(1);
}

function toPascalCase(value: string): string {
    const tokens = value
        .replace(/\.[^.]+$/, '')
        .split(/[^A-Za-z0-9]+|_/)
        .filter(Boolean);

    if (tokens.length === 0) {
        return 'NewType';
    }

    const combined = tokens.map((token) => capitalize(token)).join('');
    return /^[A-Za-z_]/.test(combined) ? combined : `_${combined}`;
}

function sanitizeNamespaceSegment(value: string): string {
    const sanitized = value.replace(/[^A-Za-z0-9_]/g, '_');
    const trimmed = sanitized.replace(/^[^A-Za-z_]+/, '');
    return trimmed || 'Project';
}

export function ensureTemplateFileName(fileName: string, extension?: string | null): string {
    const trimmed = fileName.trim();
    if (!trimmed || !extension) {
        return trimmed;
    }

    const normalizedExtension = extension.startsWith('.') ? extension.slice(1) : extension;
    if (trimmed.toLowerCase().endsWith(`.${normalizedExtension.toLowerCase()}`)) {
        return trimmed;
    }

    return `${trimmed}.${normalizedExtension}`;
}

export function buildCSharpNamespace(workspaceRoot: string | null, parentPath: string): string | null {
    if (!workspaceRoot) {
        return null;
    }

    const normalizedRoot = normalizePath(workspaceRoot);
    const normalizedParent = normalizePath(parentPath);
    const rootName = sanitizeNamespaceSegment(normalizedRoot.split('/').pop() ?? 'Project');

    if (!normalizedParent.startsWith(normalizedRoot)) {
        return rootName;
    }

    const relativePath = normalizedParent.slice(normalizedRoot.length).replace(/^\/+/, '');
    const segments = relativePath
        .split('/')
        .filter(Boolean)
        .map(sanitizeNamespaceSegment);

    return [rootName, ...segments].join('.');
}

export function buildTemplateTypeName(fileName: string): string {
    return toPascalCase(stripExtension(fileName));
}

export function buildCSharpTypeName(fileName: string): string {
    return buildTemplateTypeName(fileName);
}

function renderCSharpDeclaration(
    keyword: 'class' | 'interface' | 'enum' | 'struct' | 'record',
    args: NewFileTemplateBuildArgs,
    bodyLines: string[]
): string {
    const lines: string[] = [];

    if (args.namespaceName) {
        lines.push(`namespace ${args.namespaceName};`, '');
    }

    if (keyword === 'record') {
        lines.push(`public record ${args.typeName}();`);
        return `${lines.join('\n')}\n`;
    }

    lines.push(`public ${keyword} ${args.typeName}`);
    lines.push('{');

    for (const line of bodyLines) {
        lines.push(line ? `    ${line}` : '');
    }

    lines.push('}');

    return `${lines.join('\n')}\n`;
}

function renderReactComponent(
    componentName: string,
    extension: string
): string {
    if (extension === 'tsx') {
        return [
            `export function ${componentName}() {`,
            '    return (',
            '        <div>',
            `            ${componentName}`,
            '        </div>',
            '    );',
            '}',
            '',
            `export default ${componentName};`,
            '',
        ].join('\n');
    }

    return [
        `export function ${componentName}() {`,
        '    return (',
        '        <div>',
        `            ${componentName}`,
        '        </div>',
        '    );',
        '}',
        '',
        `export default ${componentName};`,
        '',
    ].join('\n');
}

export function getBuiltinNewFileTemplates(context: NewFileTemplateContext): NewFileTemplate[] {
    const templates: NewFileTemplate[] = [
        {
            id: 'builtin.empty-file',
            label: 'Empty File',
            description: 'Create a blank file with any name or extension.',
            category: 'General',
            extension: null,
            suggestedBaseName: 'newfile',
            priority: 5,
            buildContent: () => '',
        },
        {
            id: 'builtin.markdown',
            label: 'Markdown',
            description: 'Create a Markdown document.',
            category: 'General',
            extension: 'md',
            suggestedBaseName: 'notes',
            priority: 4,
            buildContent: () => '',
        },
        {
            id: 'builtin.json',
            label: 'JSON',
            description: 'Create a JSON file.',
            category: 'General',
            extension: 'json',
            suggestedBaseName: 'config',
            priority: 4,
            buildContent: () => '{\n  \n}\n',
        },
    ];

    if (context.projectProfile?.kind === 'dotnet' || context.projectProfile?.kind === 'mixed') {
        templates.unshift(
            {
                id: 'builtin.csharp-class',
                label: 'C# Class',
                description: 'Create a new C# class.',
                category: 'C#',
                extension: 'cs',
                suggestedBaseName: 'NewClass',
                priority: 100,
                buildContent: (args) => renderCSharpDeclaration('class', args, ['']),
            },
            {
                id: 'builtin.csharp-interface',
                label: 'C# Interface',
                description: 'Create a new C# interface.',
                category: 'C#',
                extension: 'cs',
                suggestedBaseName: 'INewInterface',
                priority: 99,
                buildContent: (args) => renderCSharpDeclaration('interface', args, ['']),
            },
            {
                id: 'builtin.csharp-enum',
                label: 'C# Enum',
                description: 'Create a new C# enum.',
                category: 'C#',
                extension: 'cs',
                suggestedBaseName: 'NewEnum',
                priority: 98,
                buildContent: (args) => renderCSharpDeclaration('enum', args, ['Value1,']),
            },
            {
                id: 'builtin.csharp-struct',
                label: 'C# Struct',
                description: 'Create a new C# struct.',
                category: 'C#',
                extension: 'cs',
                suggestedBaseName: 'NewStruct',
                priority: 97,
                buildContent: (args) => renderCSharpDeclaration('struct', args, ['']),
            },
            {
                id: 'builtin.csharp-record',
                label: 'C# Record',
                description: 'Create a new C# record.',
                category: 'C#',
                extension: 'cs',
                suggestedBaseName: 'NewRecord',
                priority: 96,
                buildContent: (args) => renderCSharpDeclaration('record', args, []),
            }
        );
    }

    if (context.projectProfile?.kind === 'javascript' || context.projectProfile?.kind === 'mixed') {
        const prefersTypeScript = Boolean(context.projectProfile.node.has_tsconfig);
        const moduleExtension = prefersTypeScript ? 'ts' : 'js';
        const reactExtension = prefersTypeScript ? 'tsx' : 'jsx';

        templates.unshift(
            {
                id: 'builtin.script-module',
                label: prefersTypeScript ? 'TypeScript Module' : 'JavaScript Module',
                description: `Create a new ${prefersTypeScript ? 'TypeScript' : 'JavaScript'} source file.`,
                category: prefersTypeScript ? 'TypeScript' : 'JavaScript',
                extension: moduleExtension,
                suggestedBaseName: 'newModule',
                priority: 90,
                buildContent: () => '',
            },
            {
                id: 'builtin.react-component',
                label: prefersTypeScript ? 'React Component (TSX)' : 'React Component (JSX)',
                description: 'Create a functional React component.',
                category: 'React',
                extension: reactExtension,
                suggestedBaseName: 'NewComponent',
                priority: 89,
                buildContent: ({ typeName }) => renderReactComponent(typeName, reactExtension),
            }
        );
    }

    return templates.sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
}

export function resolveNewFileTemplates(context: NewFileTemplateContext): NewFileTemplate[] {
    const host = getPluginHost();
    const pluginTemplates = host.getNewFileTemplates(context);

    return [...pluginTemplates, ...getBuiltinNewFileTemplates(context)].sort(
        (left, right) => (right.priority ?? 0) - (left.priority ?? 0)
    );
}
