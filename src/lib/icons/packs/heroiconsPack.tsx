/**
 * Heroicons Pack
 *
 * This pack uses Heroicons 2 (hi2) from react-icons.
 * Beautiful hand-crafted SVG icons by the makers of Tailwind CSS.
 */

import {
    HiDocument,
    HiCodeBracket,
    HiPhoto,
    HiDocumentText,
    HiLockClosed,
    HiFilm,
    HiMusicalNote,
    HiArchiveBox,
    HiCog6Tooth,
    HiCommandLine,
    HiCube,
    HiServer,
    HiGlobeAlt
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import { ReactNode } from 'react';

export function getHeroiconsFileIcon(name: string, extension: string): ReactNode {
    const normalizedName = name.toLowerCase();

    // Specific filenames have highest priority
    const specialFiles: Record<string, { icon: IconType; className: string }> = {
        // Build & Package Managers
        'package.json': { icon: HiCube, className: 'text-red-500' },
        'package-lock.json': { icon: HiCube, className: 'text-red-400' },
        'bun.lock': { icon: HiCube, className: 'text-orange-200' },
        'bun.lockb': { icon: HiCube, className: 'text-orange-200' },
        'pnpm-lock.yaml': { icon: HiCube, className: 'text-orange-400' },
        'yarn.lock': { icon: HiCube, className: 'text-blue-400' },
        'composer.json': { icon: HiCube, className: 'text-amber-600' },
        'composer.lock': { icon: HiCube, className: 'text-amber-600' },
        'cargo.toml': { icon: HiCube, className: 'text-orange-700' },
        'cargo.lock': { icon: HiCube, className: 'text-orange-700' },
        'gemfile': { icon: HiCube, className: 'text-red-500' },
        'gemfile.lock': { icon: HiCube, className: 'text-red-500' },

        // Config Files
        'tsconfig.json': { icon: HiCog6Tooth, className: 'text-blue-500' },
        'jsconfig.json': { icon: HiCog6Tooth, className: 'text-yellow-400' },
        'vite.config.ts': { icon: HiCog6Tooth, className: 'text-purple-400' },
        'vite.config.js': { icon: HiCog6Tooth, className: 'text-purple-400' },
        'next.config.js': { icon: HiCog6Tooth, className: 'text-white' },
        'next.config.mjs': { icon: HiCog6Tooth, className: 'text-white' },
        'next.config.ts': { icon: HiCog6Tooth, className: 'text-white' },
        'tailwind.config.js': { icon: HiCog6Tooth, className: 'text-cyan-400' },
        'tailwind.config.ts': { icon: HiCog6Tooth, className: 'text-cyan-400' },
        'postcss.config.js': { icon: HiCog6Tooth, className: 'text-pink-400' },
        'eslint.config.js': { icon: HiCog6Tooth, className: 'text-purple-400' },
        '.eslintrc': { icon: HiCog6Tooth, className: 'text-purple-400' },
        '.eslintrc.json': { icon: HiCog6Tooth, className: 'text-purple-400' },
        '.eslintrc.js': { icon: HiCog6Tooth, className: 'text-purple-400' },
        '.gitignore': { icon: HiDocumentText, className: 'text-orange-500' },
        '.gitattributes': { icon: HiDocumentText, className: 'text-orange-500' },
        '.env': { icon: HiLockClosed, className: 'text-emerald-400' },
        '.env.local': { icon: HiLockClosed, className: 'text-emerald-400' },
        '.env.development': { icon: HiLockClosed, className: 'text-emerald-400' },
        '.env.production': { icon: HiLockClosed, className: 'text-emerald-400' },
        '.env.example': { icon: HiLockClosed, className: 'text-emerald-400' },
        'dockerfile': { icon: HiCube, className: 'text-blue-500' },
        'docker-compose.yml': { icon: HiCube, className: 'text-blue-500' },
        'docker-compose.yaml': { icon: HiCube, className: 'text-blue-500' },
        'readme.md': { icon: HiDocumentText, className: 'text-blue-400' },
        'license': { icon: HiDocumentText, className: 'text-yellow-500' },
        'license.md': { icon: HiDocumentText, className: 'text-yellow-500' },

        // System
        'favicon.ico': { icon: HiPhoto, className: 'text-yellow-200' },
    };

    if (specialFiles[normalizedName]) {
        const { icon: Icon, className } = specialFiles[normalizedName];
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    const iconMap: Record<string, { icon: IconType; className: string }> = {
        // Web - Scripts
        'ts': { icon: HiCodeBracket, className: 'text-blue-500' },
        'tsx': { icon: HiCodeBracket, className: 'text-blue-400' },
        'js': { icon: HiCodeBracket, className: 'text-yellow-400' },
        'jsx': { icon: HiCodeBracket, className: 'text-yellow-300' },
        'mjs': { icon: HiCodeBracket, className: 'text-yellow-400' },
        'cjs': { icon: HiCodeBracket, className: 'text-yellow-400' },
        'vue': { icon: HiCodeBracket, className: 'text-emerald-400' },
        'svelte': { icon: HiCodeBracket, className: 'text-orange-500' },
        'astro': { icon: HiCodeBracket, className: 'text-orange-500' },

        // Web - Styles/Structure
        'html': { icon: HiGlobeAlt, className: 'text-orange-500' },
        'htm': { icon: HiGlobeAlt, className: 'text-orange-500' },
        'css': { icon: HiCodeBracket, className: 'text-blue-400' },
        'scss': { icon: HiCodeBracket, className: 'text-pink-400' },
        'sass': { icon: HiCodeBracket, className: 'text-pink-400' },
        'less': { icon: HiCodeBracket, className: 'text-indigo-400' },
        'styl': { icon: HiCodeBracket, className: 'text-green-400' },

        // Data & Config
        'json': { icon: HiCog6Tooth, className: 'text-yellow-200' },
        'json5': { icon: HiCog6Tooth, className: 'text-yellow-200' },
        'xml': { icon: HiCodeBracket, className: 'text-orange-400' },
        'yaml': { icon: HiCog6Tooth, className: 'text-purple-300' },
        'yml': { icon: HiCog6Tooth, className: 'text-purple-300' },
        'toml': { icon: HiCog6Tooth, className: 'text-gray-400' },
        'ini': { icon: HiCog6Tooth, className: 'text-gray-300' },
        'conf': { icon: HiCog6Tooth, className: 'text-gray-300' },
        'sql': { icon: HiServer, className: 'text-blue-400' },
        'db': { icon: HiServer, className: 'text-blue-300' },
        'sqlite': { icon: HiServer, className: 'text-blue-300' },
        'prisma': { icon: HiServer, className: 'text-teal-400' },
        'graphql': { icon: HiServer, className: 'text-pink-500' },
        'gql': { icon: HiServer, className: 'text-pink-500' },

        // Programming Languages
        'py': { icon: HiCodeBracket, className: 'text-blue-300' },
        'pyc': { icon: HiCodeBracket, className: 'text-gray-500' },
        'pyd': { icon: HiCodeBracket, className: 'text-gray-500' },
        'ipynb': { icon: HiCodeBracket, className: 'text-orange-400' },
        'rs': { icon: HiCodeBracket, className: 'text-orange-500' },
        'go': { icon: HiCodeBracket, className: 'text-cyan-400' },
        'java': { icon: HiCodeBracket, className: 'text-red-500' },
        'c': { icon: HiCodeBracket, className: 'text-blue-600' },
        'cpp': { icon: HiCodeBracket, className: 'text-blue-500' },
        'h': { icon: HiCodeBracket, className: 'text-purple-500' },
        'cs': { icon: HiCodeBracket, className: 'text-purple-500' },
        'php': { icon: HiCodeBracket, className: 'text-indigo-400' },
        'rb': { icon: HiCodeBracket, className: 'text-red-500' },
        'lua': { icon: HiCodeBracket, className: 'text-blue-300' },
        'swift': { icon: HiCodeBracket, className: 'text-orange-500' },
        'kt': { icon: HiCodeBracket, className: 'text-purple-500' },
        'dart': { icon: HiCodeBracket, className: 'text-cyan-500' },

        // Shell/Terminal
        'sh': { icon: HiCommandLine, className: 'text-green-500' },
        'bash': { icon: HiCommandLine, className: 'text-green-500' },
        'zsh': { icon: HiCommandLine, className: 'text-green-500' },
        'fish': { icon: HiCommandLine, className: 'text-green-500' },
        'bat': { icon: HiCommandLine, className: 'text-gray-300' },
        'ps1': { icon: HiCommandLine, className: 'text-blue-300' },

        // Documentation
        'md': { icon: HiDocumentText, className: 'text-blue-300' },
        'mdx': { icon: HiDocumentText, className: 'text-blue-400' },
        'txt': { icon: HiDocumentText, className: 'text-gray-400' },
        'pdf': { icon: HiDocumentText, className: 'text-red-400' },
        'doc': { icon: HiDocumentText, className: 'text-blue-600' },
        'docx': { icon: HiDocumentText, className: 'text-blue-600' },
        'csv': { icon: HiDocumentText, className: 'text-green-500' },

        // Media
        'svg': { icon: HiPhoto, className: 'text-orange-400' },
        'png': { icon: HiPhoto, className: 'text-purple-400' },
        'jpg': { icon: HiPhoto, className: 'text-purple-400' },
        'jpeg': { icon: HiPhoto, className: 'text-purple-400' },
        'gif': { icon: HiPhoto, className: 'text-purple-400' },
        'webp': { icon: HiPhoto, className: 'text-purple-400' },
        'ico': { icon: HiPhoto, className: 'text-yellow-500' },
        'mp3': { icon: HiMusicalNote, className: 'text-pink-400' },
        'wav': { icon: HiMusicalNote, className: 'text-pink-400' },
        'mp4': { icon: HiFilm, className: 'text-red-400' },
        'webm': { icon: HiFilm, className: 'text-red-400' },
        'mov': { icon: HiFilm, className: 'text-red-400' },

        // Archives
        'zip': { icon: HiArchiveBox, className: 'text-yellow-600' },
        'tar': { icon: HiArchiveBox, className: 'text-yellow-600' },
        'gz': { icon: HiArchiveBox, className: 'text-yellow-600' },
        'rar': { icon: HiArchiveBox, className: 'text-yellow-600' },
        '7z': { icon: HiArchiveBox, className: 'text-yellow-600' },

        // Fonts
        'ttf': { icon: HiDocumentText, className: 'text-gray-400' },
        'otf': { icon: HiDocumentText, className: 'text-gray-400' },
        'woff': { icon: HiDocumentText, className: 'text-gray-400' },
        'woff2': { icon: HiDocumentText, className: 'text-gray-400' },
    };

    const iconEntry = iconMap[extension];

    if (iconEntry) {
        const { icon: Icon, className } = iconEntry;
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    return <HiDocument className="w-4 h-4 shrink-0 text-muted-foreground" />;
}
