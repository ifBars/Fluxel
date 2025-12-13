/**
 * Feather Icons Pack
 *
 * This pack uses Feather Icons (fi) from react-icons.
 * Feather is a collection of simply beautiful open source icons.
 */

import {
    FiFile,
    FiCode,
    FiImage,
    FiFileText,
    FiLock,
    FiFilm,
    FiMusic,
    FiArchive,
    FiSettings,
    FiTerminal,
    FiPackage,
    FiGitBranch,
    FiDatabase,
    FiGlobe
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { ReactNode } from 'react';

export function getFeatherFileIcon(name: string, extension: string): ReactNode {
    const normalizedName = name.toLowerCase();

    // Specific filenames have highest priority
    const specialFiles: Record<string, { icon: IconType; className: string }> = {
        // Build & Package Managers
        'package.json': { icon: FiPackage, className: 'text-red-500' },
        'package-lock.json': { icon: FiPackage, className: 'text-red-400' },
        'bun.lock': { icon: FiPackage, className: 'text-orange-200' },
        'bun.lockb': { icon: FiPackage, className: 'text-orange-200' },
        'pnpm-lock.yaml': { icon: FiPackage, className: 'text-orange-400' },
        'yarn.lock': { icon: FiPackage, className: 'text-blue-400' },
        'composer.json': { icon: FiPackage, className: 'text-amber-600' },
        'composer.lock': { icon: FiPackage, className: 'text-amber-600' },
        'cargo.toml': { icon: FiPackage, className: 'text-orange-700' },
        'cargo.lock': { icon: FiPackage, className: 'text-orange-700' },
        'gemfile': { icon: FiPackage, className: 'text-red-500' },
        'gemfile.lock': { icon: FiPackage, className: 'text-red-500' },

        // Config Files
        'tsconfig.json': { icon: FiSettings, className: 'text-blue-500' },
        'jsconfig.json': { icon: FiSettings, className: 'text-yellow-400' },
        'vite.config.ts': { icon: FiSettings, className: 'text-purple-400' },
        'vite.config.js': { icon: FiSettings, className: 'text-purple-400' },
        'next.config.js': { icon: FiSettings, className: 'text-white' },
        'next.config.mjs': { icon: FiSettings, className: 'text-white' },
        'next.config.ts': { icon: FiSettings, className: 'text-white' },
        'tailwind.config.js': { icon: FiSettings, className: 'text-cyan-400' },
        'tailwind.config.ts': { icon: FiSettings, className: 'text-cyan-400' },
        'postcss.config.js': { icon: FiSettings, className: 'text-pink-400' },
        'eslint.config.js': { icon: FiSettings, className: 'text-purple-400' },
        '.eslintrc': { icon: FiSettings, className: 'text-purple-400' },
        '.eslintrc.json': { icon: FiSettings, className: 'text-purple-400' },
        '.eslintrc.js': { icon: FiSettings, className: 'text-purple-400' },
        '.gitignore': { icon: FiGitBranch, className: 'text-orange-500' },
        '.gitattributes': { icon: FiGitBranch, className: 'text-orange-500' },
        '.env': { icon: FiLock, className: 'text-emerald-400' },
        '.env.local': { icon: FiLock, className: 'text-emerald-400' },
        '.env.development': { icon: FiLock, className: 'text-emerald-400' },
        '.env.production': { icon: FiLock, className: 'text-emerald-400' },
        '.env.example': { icon: FiLock, className: 'text-emerald-400' },
        'dockerfile': { icon: FiPackage, className: 'text-blue-500' },
        'docker-compose.yml': { icon: FiPackage, className: 'text-blue-500' },
        'docker-compose.yaml': { icon: FiPackage, className: 'text-blue-500' },
        'readme.md': { icon: FiFileText, className: 'text-blue-400' },
        'license': { icon: FiFileText, className: 'text-yellow-500' },
        'license.md': { icon: FiFileText, className: 'text-yellow-500' },

        // System
        'favicon.ico': { icon: FiImage, className: 'text-yellow-200' },
    };

    if (specialFiles[normalizedName]) {
        const { icon: Icon, className } = specialFiles[normalizedName];
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    const iconMap: Record<string, { icon: IconType; className: string }> = {
        // Web - Scripts
        'ts': { icon: FiCode, className: 'text-blue-500' },
        'tsx': { icon: FiCode, className: 'text-blue-400' },
        'js': { icon: FiCode, className: 'text-yellow-400' },
        'jsx': { icon: FiCode, className: 'text-yellow-300' },
        'mjs': { icon: FiCode, className: 'text-yellow-400' },
        'cjs': { icon: FiCode, className: 'text-yellow-400' },
        'vue': { icon: FiCode, className: 'text-emerald-400' },
        'svelte': { icon: FiCode, className: 'text-orange-500' },
        'astro': { icon: FiCode, className: 'text-orange-500' },

        // Web - Styles/Structure
        'html': { icon: FiGlobe, className: 'text-orange-500' },
        'htm': { icon: FiGlobe, className: 'text-orange-500' },
        'css': { icon: FiCode, className: 'text-blue-400' },
        'scss': { icon: FiCode, className: 'text-pink-400' },
        'sass': { icon: FiCode, className: 'text-pink-400' },
        'less': { icon: FiCode, className: 'text-indigo-400' },
        'styl': { icon: FiCode, className: 'text-green-400' },

        // Data & Config
        'json': { icon: FiSettings, className: 'text-yellow-200' },
        'json5': { icon: FiSettings, className: 'text-yellow-200' },
        'xml': { icon: FiCode, className: 'text-orange-400' },
        'yaml': { icon: FiSettings, className: 'text-purple-300' },
        'yml': { icon: FiSettings, className: 'text-purple-300' },
        'toml': { icon: FiSettings, className: 'text-gray-400' },
        'ini': { icon: FiSettings, className: 'text-gray-300' },
        'conf': { icon: FiSettings, className: 'text-gray-300' },
        'sql': { icon: FiDatabase, className: 'text-blue-400' },
        'db': { icon: FiDatabase, className: 'text-blue-300' },
        'sqlite': { icon: FiDatabase, className: 'text-blue-300' },
        'prisma': { icon: FiDatabase, className: 'text-teal-400' },
        'graphql': { icon: FiDatabase, className: 'text-pink-500' },
        'gql': { icon: FiDatabase, className: 'text-pink-500' },

        // Programming Languages
        'py': { icon: FiCode, className: 'text-blue-300' },
        'pyc': { icon: FiCode, className: 'text-gray-500' },
        'pyd': { icon: FiCode, className: 'text-gray-500' },
        'ipynb': { icon: FiCode, className: 'text-orange-400' },
        'rs': { icon: FiCode, className: 'text-orange-500' },
        'go': { icon: FiCode, className: 'text-cyan-400' },
        'java': { icon: FiCode, className: 'text-red-500' },
        'c': { icon: FiCode, className: 'text-blue-600' },
        'cpp': { icon: FiCode, className: 'text-blue-500' },
        'h': { icon: FiCode, className: 'text-purple-500' },
        'cs': { icon: FiCode, className: 'text-purple-500' },
        'php': { icon: FiCode, className: 'text-indigo-400' },
        'rb': { icon: FiCode, className: 'text-red-500' },
        'lua': { icon: FiCode, className: 'text-blue-300' },
        'swift': { icon: FiCode, className: 'text-orange-500' },
        'kt': { icon: FiCode, className: 'text-purple-500' },
        'dart': { icon: FiCode, className: 'text-cyan-500' },

        // Shell/Terminal
        'sh': { icon: FiTerminal, className: 'text-green-500' },
        'bash': { icon: FiTerminal, className: 'text-green-500' },
        'zsh': { icon: FiTerminal, className: 'text-green-500' },
        'fish': { icon: FiTerminal, className: 'text-green-500' },
        'bat': { icon: FiTerminal, className: 'text-gray-300' },
        'ps1': { icon: FiTerminal, className: 'text-blue-300' },

        // Documentation
        'md': { icon: FiFileText, className: 'text-blue-300' },
        'mdx': { icon: FiFileText, className: 'text-blue-400' },
        'txt': { icon: FiFileText, className: 'text-gray-400' },
        'pdf': { icon: FiFileText, className: 'text-red-400' },
        'doc': { icon: FiFileText, className: 'text-blue-600' },
        'docx': { icon: FiFileText, className: 'text-blue-600' },
        'csv': { icon: FiFileText, className: 'text-green-500' },

        // Media
        'svg': { icon: FiImage, className: 'text-orange-400' },
        'png': { icon: FiImage, className: 'text-purple-400' },
        'jpg': { icon: FiImage, className: 'text-purple-400' },
        'jpeg': { icon: FiImage, className: 'text-purple-400' },
        'gif': { icon: FiImage, className: 'text-purple-400' },
        'webp': { icon: FiImage, className: 'text-purple-400' },
        'ico': { icon: FiImage, className: 'text-yellow-500' },
        'mp3': { icon: FiMusic, className: 'text-pink-400' },
        'wav': { icon: FiMusic, className: 'text-pink-400' },
        'mp4': { icon: FiFilm, className: 'text-red-400' },
        'webm': { icon: FiFilm, className: 'text-red-400' },
        'mov': { icon: FiFilm, className: 'text-red-400' },

        // Archives
        'zip': { icon: FiArchive, className: 'text-yellow-600' },
        'tar': { icon: FiArchive, className: 'text-yellow-600' },
        'gz': { icon: FiArchive, className: 'text-yellow-600' },
        'rar': { icon: FiArchive, className: 'text-yellow-600' },
        '7z': { icon: FiArchive, className: 'text-yellow-600' },

        // Fonts
        'ttf': { icon: FiFileText, className: 'text-gray-400' },
        'otf': { icon: FiFileText, className: 'text-gray-400' },
        'woff': { icon: FiFileText, className: 'text-gray-400' },
        'woff2': { icon: FiFileText, className: 'text-gray-400' },
    };

    const iconEntry = iconMap[extension];

    if (iconEntry) {
        const { icon: Icon, className } = iconEntry;
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    return <FiFile className="w-4 h-4 shrink-0 text-muted-foreground" />;
}
