/**
 * Tabler Icons Pack
 *
 * This pack uses Tabler Icons (tb) from react-icons.
 * Over 5700+ pixel-perfect icons for web design.
 */

import {
    TbFile,
    TbFileCode,
    TbPhoto,
    TbFileText,
    TbLock,
    TbMovie,
    TbMusic,
    TbFileZip,
    TbSettings,
    TbTerminal,
    TbPackage,
    TbGitBranch,
    TbDatabase,
    TbWorld
} from 'react-icons/tb';
import type { IconType } from 'react-icons';
import { ReactNode } from 'react';

export function getTablerFileIcon(name: string, extension: string): ReactNode {
    const normalizedName = name.toLowerCase();

    // Specific filenames have highest priority
    const specialFiles: Record<string, { icon: IconType; className: string }> = {
        // Build & Package Managers
        'package.json': { icon: TbPackage, className: 'text-red-500' },
        'package-lock.json': { icon: TbPackage, className: 'text-red-400' },
        'bun.lock': { icon: TbPackage, className: 'text-orange-200' },
        'bun.lockb': { icon: TbPackage, className: 'text-orange-200' },
        'pnpm-lock.yaml': { icon: TbPackage, className: 'text-orange-400' },
        'yarn.lock': { icon: TbPackage, className: 'text-blue-400' },
        'composer.json': { icon: TbPackage, className: 'text-amber-600' },
        'composer.lock': { icon: TbPackage, className: 'text-amber-600' },
        'cargo.toml': { icon: TbPackage, className: 'text-orange-700' },
        'cargo.lock': { icon: TbPackage, className: 'text-orange-700' },
        'gemfile': { icon: TbPackage, className: 'text-red-500' },
        'gemfile.lock': { icon: TbPackage, className: 'text-red-500' },

        // Config Files
        'tsconfig.json': { icon: TbSettings, className: 'text-blue-500' },
        'jsconfig.json': { icon: TbSettings, className: 'text-yellow-400' },
        'vite.config.ts': { icon: TbSettings, className: 'text-purple-400' },
        'vite.config.js': { icon: TbSettings, className: 'text-purple-400' },
        'next.config.js': { icon: TbSettings, className: 'text-white' },
        'next.config.mjs': { icon: TbSettings, className: 'text-white' },
        'next.config.ts': { icon: TbSettings, className: 'text-white' },
        'tailwind.config.js': { icon: TbSettings, className: 'text-cyan-400' },
        'tailwind.config.ts': { icon: TbSettings, className: 'text-cyan-400' },
        'postcss.config.js': { icon: TbSettings, className: 'text-pink-400' },
        'eslint.config.js': { icon: TbSettings, className: 'text-purple-400' },
        '.eslintrc': { icon: TbSettings, className: 'text-purple-400' },
        '.eslintrc.json': { icon: TbSettings, className: 'text-purple-400' },
        '.eslintrc.js': { icon: TbSettings, className: 'text-purple-400' },
        '.gitignore': { icon: TbGitBranch, className: 'text-orange-500' },
        '.gitattributes': { icon: TbGitBranch, className: 'text-orange-500' },
        '.env': { icon: TbLock, className: 'text-emerald-400' },
        '.env.local': { icon: TbLock, className: 'text-emerald-400' },
        '.env.development': { icon: TbLock, className: 'text-emerald-400' },
        '.env.production': { icon: TbLock, className: 'text-emerald-400' },
        '.env.example': { icon: TbLock, className: 'text-emerald-400' },
        'dockerfile': { icon: TbPackage, className: 'text-blue-500' },
        'docker-compose.yml': { icon: TbPackage, className: 'text-blue-500' },
        'docker-compose.yaml': { icon: TbPackage, className: 'text-blue-500' },
        'readme.md': { icon: TbFileText, className: 'text-blue-400' },
        'license': { icon: TbFileText, className: 'text-yellow-500' },
        'license.md': { icon: TbFileText, className: 'text-yellow-500' },

        // System
        'favicon.ico': { icon: TbPhoto, className: 'text-yellow-200' },
    };

    if (specialFiles[normalizedName]) {
        const { icon: Icon, className } = specialFiles[normalizedName];
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    const iconMap: Record<string, { icon: IconType; className: string }> = {
        // Web - Scripts
        'ts': { icon: TbFileCode, className: 'text-blue-500' },
        'tsx': { icon: TbFileCode, className: 'text-blue-400' },
        'js': { icon: TbFileCode, className: 'text-yellow-400' },
        'jsx': { icon: TbFileCode, className: 'text-yellow-300' },
        'mjs': { icon: TbFileCode, className: 'text-yellow-400' },
        'cjs': { icon: TbFileCode, className: 'text-yellow-400' },
        'vue': { icon: TbFileCode, className: 'text-emerald-400' },
        'svelte': { icon: TbFileCode, className: 'text-orange-500' },
        'astro': { icon: TbFileCode, className: 'text-orange-500' },

        // Web - Styles/Structure
        'html': { icon: TbWorld, className: 'text-orange-500' },
        'htm': { icon: TbWorld, className: 'text-orange-500' },
        'css': { icon: TbFileCode, className: 'text-blue-400' },
        'scss': { icon: TbFileCode, className: 'text-pink-400' },
        'sass': { icon: TbFileCode, className: 'text-pink-400' },
        'less': { icon: TbFileCode, className: 'text-indigo-400' },
        'styl': { icon: TbFileCode, className: 'text-green-400' },

        // Data & Config
        'json': { icon: TbSettings, className: 'text-yellow-200' },
        'json5': { icon: TbSettings, className: 'text-yellow-200' },
        'xml': { icon: TbFileCode, className: 'text-orange-400' },
        'yaml': { icon: TbSettings, className: 'text-purple-300' },
        'yml': { icon: TbSettings, className: 'text-purple-300' },
        'toml': { icon: TbSettings, className: 'text-gray-400' },
        'ini': { icon: TbSettings, className: 'text-gray-300' },
        'conf': { icon: TbSettings, className: 'text-gray-300' },
        'sql': { icon: TbDatabase, className: 'text-blue-400' },
        'db': { icon: TbDatabase, className: 'text-blue-300' },
        'sqlite': { icon: TbDatabase, className: 'text-blue-300' },
        'prisma': { icon: TbDatabase, className: 'text-teal-400' },
        'graphql': { icon: TbDatabase, className: 'text-pink-500' },
        'gql': { icon: TbDatabase, className: 'text-pink-500' },

        // Programming Languages
        'py': { icon: TbFileCode, className: 'text-blue-300' },
        'pyc': { icon: TbFileCode, className: 'text-gray-500' },
        'pyd': { icon: TbFileCode, className: 'text-gray-500' },
        'ipynb': { icon: TbFileCode, className: 'text-orange-400' },
        'rs': { icon: TbFileCode, className: 'text-orange-500' },
        'go': { icon: TbFileCode, className: 'text-cyan-400' },
        'java': { icon: TbFileCode, className: 'text-red-500' },
        'c': { icon: TbFileCode, className: 'text-blue-600' },
        'cpp': { icon: TbFileCode, className: 'text-blue-500' },
        'h': { icon: TbFileCode, className: 'text-purple-500' },
        'cs': { icon: TbFileCode, className: 'text-purple-500' },
        'php': { icon: TbFileCode, className: 'text-indigo-400' },
        'rb': { icon: TbFileCode, className: 'text-red-500' },
        'lua': { icon: TbFileCode, className: 'text-blue-300' },
        'swift': { icon: TbFileCode, className: 'text-orange-500' },
        'kt': { icon: TbFileCode, className: 'text-purple-500' },
        'dart': { icon: TbFileCode, className: 'text-cyan-500' },

        // Shell/Terminal
        'sh': { icon: TbTerminal, className: 'text-green-500' },
        'bash': { icon: TbTerminal, className: 'text-green-500' },
        'zsh': { icon: TbTerminal, className: 'text-green-500' },
        'fish': { icon: TbTerminal, className: 'text-green-500' },
        'bat': { icon: TbTerminal, className: 'text-gray-300' },
        'ps1': { icon: TbTerminal, className: 'text-blue-300' },

        // Documentation
        'md': { icon: TbFileText, className: 'text-blue-300' },
        'mdx': { icon: TbFileText, className: 'text-blue-400' },
        'txt': { icon: TbFileText, className: 'text-gray-400' },
        'pdf': { icon: TbFileText, className: 'text-red-400' },
        'doc': { icon: TbFileText, className: 'text-blue-600' },
        'docx': { icon: TbFileText, className: 'text-blue-600' },
        'csv': { icon: TbFileText, className: 'text-green-500' },

        // Media
        'svg': { icon: TbPhoto, className: 'text-orange-400' },
        'png': { icon: TbPhoto, className: 'text-purple-400' },
        'jpg': { icon: TbPhoto, className: 'text-purple-400' },
        'jpeg': { icon: TbPhoto, className: 'text-purple-400' },
        'gif': { icon: TbPhoto, className: 'text-purple-400' },
        'webp': { icon: TbPhoto, className: 'text-purple-400' },
        'ico': { icon: TbPhoto, className: 'text-yellow-500' },
        'mp3': { icon: TbMusic, className: 'text-pink-400' },
        'wav': { icon: TbMusic, className: 'text-pink-400' },
        'mp4': { icon: TbMovie, className: 'text-red-400' },
        'webm': { icon: TbMovie, className: 'text-red-400' },
        'mov': { icon: TbMovie, className: 'text-red-400' },

        // Archives
        'zip': { icon: TbFileZip, className: 'text-yellow-600' },
        'tar': { icon: TbFileZip, className: 'text-yellow-600' },
        'gz': { icon: TbFileZip, className: 'text-yellow-600' },
        'rar': { icon: TbFileZip, className: 'text-yellow-600' },
        '7z': { icon: TbFileZip, className: 'text-yellow-600' },

        // Fonts
        'ttf': { icon: TbFileText, className: 'text-gray-400' },
        'otf': { icon: TbFileText, className: 'text-gray-400' },
        'woff': { icon: TbFileText, className: 'text-gray-400' },
        'woff2': { icon: TbFileText, className: 'text-gray-400' },
    };

    const iconEntry = iconMap[extension];

    if (iconEntry) {
        const { icon: Icon, className } = iconEntry;
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    return <TbFile className="w-4 h-4 shrink-0 text-muted-foreground" />;
}
