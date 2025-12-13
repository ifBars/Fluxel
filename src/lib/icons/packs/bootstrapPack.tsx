/**
 * Bootstrap Icons Pack
 *
 * This pack uses Bootstrap Icons (bs) from react-icons.
 * Official open source icon library from Bootstrap.
 */

import {
    BsFileEarmark,
    BsFileEarmarkCode,
    BsFileEarmarkImage,
    BsFileEarmarkText,
    BsFileEarmarkLock,
    BsFileEarmarkPlay,
    BsFileEarmarkMusic,
    BsFileEarmarkZip,
    BsGear,
    BsTerminal,
    BsBox,
    BsGit,
    BsDatabase,
    BsGlobe
} from 'react-icons/bs';
import type { IconType } from 'react-icons';
import { ReactNode } from 'react';

export function getBootstrapFileIcon(name: string, extension: string): ReactNode {
    const normalizedName = name.toLowerCase();

    // Specific filenames have highest priority
    const specialFiles: Record<string, { icon: IconType; className: string }> = {
        // Build & Package Managers
        'package.json': { icon: BsBox, className: 'text-red-500' },
        'package-lock.json': { icon: BsBox, className: 'text-red-400' },
        'bun.lock': { icon: BsBox, className: 'text-orange-200' },
        'bun.lockb': { icon: BsBox, className: 'text-orange-200' },
        'pnpm-lock.yaml': { icon: BsBox, className: 'text-orange-400' },
        'yarn.lock': { icon: BsBox, className: 'text-blue-400' },
        'composer.json': { icon: BsBox, className: 'text-amber-600' },
        'composer.lock': { icon: BsBox, className: 'text-amber-600' },
        'cargo.toml': { icon: BsBox, className: 'text-orange-700' },
        'cargo.lock': { icon: BsBox, className: 'text-orange-700' },
        'gemfile': { icon: BsBox, className: 'text-red-500' },
        'gemfile.lock': { icon: BsBox, className: 'text-red-500' },

        // Config Files
        'tsconfig.json': { icon: BsGear, className: 'text-blue-500' },
        'jsconfig.json': { icon: BsGear, className: 'text-yellow-400' },
        'vite.config.ts': { icon: BsGear, className: 'text-purple-400' },
        'vite.config.js': { icon: BsGear, className: 'text-purple-400' },
        'next.config.js': { icon: BsGear, className: 'text-white' },
        'next.config.mjs': { icon: BsGear, className: 'text-white' },
        'next.config.ts': { icon: BsGear, className: 'text-white' },
        'tailwind.config.js': { icon: BsGear, className: 'text-cyan-400' },
        'tailwind.config.ts': { icon: BsGear, className: 'text-cyan-400' },
        'postcss.config.js': { icon: BsGear, className: 'text-pink-400' },
        'eslint.config.js': { icon: BsGear, className: 'text-purple-400' },
        '.eslintrc': { icon: BsGear, className: 'text-purple-400' },
        '.eslintrc.json': { icon: BsGear, className: 'text-purple-400' },
        '.eslintrc.js': { icon: BsGear, className: 'text-purple-400' },
        '.gitignore': { icon: BsGit, className: 'text-orange-500' },
        '.gitattributes': { icon: BsGit, className: 'text-orange-500' },
        '.env': { icon: BsFileEarmarkLock, className: 'text-emerald-400' },
        '.env.local': { icon: BsFileEarmarkLock, className: 'text-emerald-400' },
        '.env.development': { icon: BsFileEarmarkLock, className: 'text-emerald-400' },
        '.env.production': { icon: BsFileEarmarkLock, className: 'text-emerald-400' },
        '.env.example': { icon: BsFileEarmarkLock, className: 'text-emerald-400' },
        'dockerfile': { icon: BsBox, className: 'text-blue-500' },
        'docker-compose.yml': { icon: BsBox, className: 'text-blue-500' },
        'docker-compose.yaml': { icon: BsBox, className: 'text-blue-500' },
        'readme.md': { icon: BsFileEarmarkText, className: 'text-blue-400' },
        'license': { icon: BsFileEarmarkText, className: 'text-yellow-500' },
        'license.md': { icon: BsFileEarmarkText, className: 'text-yellow-500' },

        // System
        'favicon.ico': { icon: BsFileEarmarkImage, className: 'text-yellow-200' },
    };

    if (specialFiles[normalizedName]) {
        const { icon: Icon, className } = specialFiles[normalizedName];
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    const iconMap: Record<string, { icon: IconType; className: string }> = {
        // Web - Scripts
        'ts': { icon: BsFileEarmarkCode, className: 'text-blue-500' },
        'tsx': { icon: BsFileEarmarkCode, className: 'text-blue-400' },
        'js': { icon: BsFileEarmarkCode, className: 'text-yellow-400' },
        'jsx': { icon: BsFileEarmarkCode, className: 'text-yellow-300' },
        'mjs': { icon: BsFileEarmarkCode, className: 'text-yellow-400' },
        'cjs': { icon: BsFileEarmarkCode, className: 'text-yellow-400' },
        'vue': { icon: BsFileEarmarkCode, className: 'text-emerald-400' },
        'svelte': { icon: BsFileEarmarkCode, className: 'text-orange-500' },
        'astro': { icon: BsFileEarmarkCode, className: 'text-orange-500' },

        // Web - Styles/Structure
        'html': { icon: BsGlobe, className: 'text-orange-500' },
        'htm': { icon: BsGlobe, className: 'text-orange-500' },
        'css': { icon: BsFileEarmarkCode, className: 'text-blue-400' },
        'scss': { icon: BsFileEarmarkCode, className: 'text-pink-400' },
        'sass': { icon: BsFileEarmarkCode, className: 'text-pink-400' },
        'less': { icon: BsFileEarmarkCode, className: 'text-indigo-400' },
        'styl': { icon: BsFileEarmarkCode, className: 'text-green-400' },

        // Data & Config
        'json': { icon: BsGear, className: 'text-yellow-200' },
        'json5': { icon: BsGear, className: 'text-yellow-200' },
        'xml': { icon: BsFileEarmarkCode, className: 'text-orange-400' },
        'yaml': { icon: BsGear, className: 'text-purple-300' },
        'yml': { icon: BsGear, className: 'text-purple-300' },
        'toml': { icon: BsGear, className: 'text-gray-400' },
        'ini': { icon: BsGear, className: 'text-gray-300' },
        'conf': { icon: BsGear, className: 'text-gray-300' },
        'sql': { icon: BsDatabase, className: 'text-blue-400' },
        'db': { icon: BsDatabase, className: 'text-blue-300' },
        'sqlite': { icon: BsDatabase, className: 'text-blue-300' },
        'prisma': { icon: BsDatabase, className: 'text-teal-400' },
        'graphql': { icon: BsDatabase, className: 'text-pink-500' },
        'gql': { icon: BsDatabase, className: 'text-pink-500' },

        // Programming Languages
        'py': { icon: BsFileEarmarkCode, className: 'text-blue-300' },
        'pyc': { icon: BsFileEarmarkCode, className: 'text-gray-500' },
        'pyd': { icon: BsFileEarmarkCode, className: 'text-gray-500' },
        'ipynb': { icon: BsFileEarmarkCode, className: 'text-orange-400' },
        'rs': { icon: BsFileEarmarkCode, className: 'text-orange-500' },
        'go': { icon: BsFileEarmarkCode, className: 'text-cyan-400' },
        'java': { icon: BsFileEarmarkCode, className: 'text-red-500' },
        'c': { icon: BsFileEarmarkCode, className: 'text-blue-600' },
        'cpp': { icon: BsFileEarmarkCode, className: 'text-blue-500' },
        'h': { icon: BsFileEarmarkCode, className: 'text-purple-500' },
        'cs': { icon: BsFileEarmarkCode, className: 'text-purple-500' },
        'php': { icon: BsFileEarmarkCode, className: 'text-indigo-400' },
        'rb': { icon: BsFileEarmarkCode, className: 'text-red-500' },
        'lua': { icon: BsFileEarmarkCode, className: 'text-blue-300' },
        'swift': { icon: BsFileEarmarkCode, className: 'text-orange-500' },
        'kt': { icon: BsFileEarmarkCode, className: 'text-purple-500' },
        'dart': { icon: BsFileEarmarkCode, className: 'text-cyan-500' },

        // Shell/Terminal
        'sh': { icon: BsTerminal, className: 'text-green-500' },
        'bash': { icon: BsTerminal, className: 'text-green-500' },
        'zsh': { icon: BsTerminal, className: 'text-green-500' },
        'fish': { icon: BsTerminal, className: 'text-green-500' },
        'bat': { icon: BsTerminal, className: 'text-gray-300' },
        'ps1': { icon: BsTerminal, className: 'text-blue-300' },

        // Documentation
        'md': { icon: BsFileEarmarkText, className: 'text-blue-300' },
        'mdx': { icon: BsFileEarmarkText, className: 'text-blue-400' },
        'txt': { icon: BsFileEarmarkText, className: 'text-gray-400' },
        'pdf': { icon: BsFileEarmarkText, className: 'text-red-400' },
        'doc': { icon: BsFileEarmarkText, className: 'text-blue-600' },
        'docx': { icon: BsFileEarmarkText, className: 'text-blue-600' },
        'csv': { icon: BsFileEarmarkText, className: 'text-green-500' },

        // Media
        'svg': { icon: BsFileEarmarkImage, className: 'text-orange-400' },
        'png': { icon: BsFileEarmarkImage, className: 'text-purple-400' },
        'jpg': { icon: BsFileEarmarkImage, className: 'text-purple-400' },
        'jpeg': { icon: BsFileEarmarkImage, className: 'text-purple-400' },
        'gif': { icon: BsFileEarmarkImage, className: 'text-purple-400' },
        'webp': { icon: BsFileEarmarkImage, className: 'text-purple-400' },
        'ico': { icon: BsFileEarmarkImage, className: 'text-yellow-500' },
        'mp3': { icon: BsFileEarmarkMusic, className: 'text-pink-400' },
        'wav': { icon: BsFileEarmarkMusic, className: 'text-pink-400' },
        'mp4': { icon: BsFileEarmarkPlay, className: 'text-red-400' },
        'webm': { icon: BsFileEarmarkPlay, className: 'text-red-400' },
        'mov': { icon: BsFileEarmarkPlay, className: 'text-red-400' },

        // Archives
        'zip': { icon: BsFileEarmarkZip, className: 'text-yellow-600' },
        'tar': { icon: BsFileEarmarkZip, className: 'text-yellow-600' },
        'gz': { icon: BsFileEarmarkZip, className: 'text-yellow-600' },
        'rar': { icon: BsFileEarmarkZip, className: 'text-yellow-600' },
        '7z': { icon: BsFileEarmarkZip, className: 'text-yellow-600' },

        // Fonts
        'ttf': { icon: BsFileEarmarkText, className: 'text-gray-400' },
        'otf': { icon: BsFileEarmarkText, className: 'text-gray-400' },
        'woff': { icon: BsFileEarmarkText, className: 'text-gray-400' },
        'woff2': { icon: BsFileEarmarkText, className: 'text-gray-400' },
    };

    const iconEntry = iconMap[extension];

    if (iconEntry) {
        const { icon: Icon, className } = iconEntry;
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    return <BsFileEarmark className="w-4 h-4 shrink-0 text-muted-foreground" />;
}
