/**
 * Phosphor Icons Pack
 *
 * This pack uses Phosphor Icons (pi) from react-icons.
 * A flexible icon family with over 9000 icons for interfaces, diagrams, presentations.
 */

import {
    PiFile,
    PiFileCode,
    PiFileImage,
    PiFileText,
    PiFileLock,
    PiFileVideo,
    PiFileAudio,
    PiFileZip,
    PiGear,
    PiTerminal,
    PiPackage,
    PiGitBranch,
    PiDatabase,
    PiGlobe
} from 'react-icons/pi';
import type { IconType } from 'react-icons';
import { ReactNode } from 'react';

export function getPhosphorFileIcon(name: string, extension: string): ReactNode {
    const normalizedName = name.toLowerCase();

    // Specific filenames have highest priority
    const specialFiles: Record<string, { icon: IconType; className: string }> = {
        // Build & Package Managers
        'package.json': { icon: PiPackage, className: 'text-red-500' },
        'package-lock.json': { icon: PiPackage, className: 'text-red-400' },
        'bun.lock': { icon: PiPackage, className: 'text-orange-200' },
        'bun.lockb': { icon: PiPackage, className: 'text-orange-200' },
        'pnpm-lock.yaml': { icon: PiPackage, className: 'text-orange-400' },
        'yarn.lock': { icon: PiPackage, className: 'text-blue-400' },
        'composer.json': { icon: PiPackage, className: 'text-amber-600' },
        'composer.lock': { icon: PiPackage, className: 'text-amber-600' },
        'cargo.toml': { icon: PiPackage, className: 'text-orange-700' },
        'cargo.lock': { icon: PiPackage, className: 'text-orange-700' },
        'gemfile': { icon: PiPackage, className: 'text-red-500' },
        'gemfile.lock': { icon: PiPackage, className: 'text-red-500' },

        // Config Files
        'tsconfig.json': { icon: PiGear, className: 'text-blue-500' },
        'jsconfig.json': { icon: PiGear, className: 'text-yellow-400' },
        'vite.config.ts': { icon: PiGear, className: 'text-purple-400' },
        'vite.config.js': { icon: PiGear, className: 'text-purple-400' },
        'next.config.js': { icon: PiGear, className: 'text-white' },
        'next.config.mjs': { icon: PiGear, className: 'text-white' },
        'next.config.ts': { icon: PiGear, className: 'text-white' },
        'tailwind.config.js': { icon: PiGear, className: 'text-cyan-400' },
        'tailwind.config.ts': { icon: PiGear, className: 'text-cyan-400' },
        'postcss.config.js': { icon: PiGear, className: 'text-pink-400' },
        'eslint.config.js': { icon: PiGear, className: 'text-purple-400' },
        '.eslintrc': { icon: PiGear, className: 'text-purple-400' },
        '.eslintrc.json': { icon: PiGear, className: 'text-purple-400' },
        '.eslintrc.js': { icon: PiGear, className: 'text-purple-400' },
        '.gitignore': { icon: PiGitBranch, className: 'text-orange-500' },
        '.gitattributes': { icon: PiGitBranch, className: 'text-orange-500' },
        '.env': { icon: PiFileLock, className: 'text-emerald-400' },
        '.env.local': { icon: PiFileLock, className: 'text-emerald-400' },
        '.env.development': { icon: PiFileLock, className: 'text-emerald-400' },
        '.env.production': { icon: PiFileLock, className: 'text-emerald-400' },
        '.env.example': { icon: PiFileLock, className: 'text-emerald-400' },
        'dockerfile': { icon: PiPackage, className: 'text-blue-500' },
        'docker-compose.yml': { icon: PiPackage, className: 'text-blue-500' },
        'docker-compose.yaml': { icon: PiPackage, className: 'text-blue-500' },
        'readme.md': { icon: PiFileText, className: 'text-blue-400' },
        'license': { icon: PiFileText, className: 'text-yellow-500' },
        'license.md': { icon: PiFileText, className: 'text-yellow-500' },

        // System
        'favicon.ico': { icon: PiFileImage, className: 'text-yellow-200' },
    };

    if (specialFiles[normalizedName]) {
        const { icon: Icon, className } = specialFiles[normalizedName];
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    const iconMap: Record<string, { icon: IconType; className: string }> = {
        // Web - Scripts
        'ts': { icon: PiFileCode, className: 'text-blue-500' },
        'tsx': { icon: PiFileCode, className: 'text-blue-400' },
        'js': { icon: PiFileCode, className: 'text-yellow-400' },
        'jsx': { icon: PiFileCode, className: 'text-yellow-300' },
        'mjs': { icon: PiFileCode, className: 'text-yellow-400' },
        'cjs': { icon: PiFileCode, className: 'text-yellow-400' },
        'vue': { icon: PiFileCode, className: 'text-emerald-400' },
        'svelte': { icon: PiFileCode, className: 'text-orange-500' },
        'astro': { icon: PiFileCode, className: 'text-orange-500' },

        // Web - Styles/Structure
        'html': { icon: PiGlobe, className: 'text-orange-500' },
        'htm': { icon: PiGlobe, className: 'text-orange-500' },
        'css': { icon: PiFileCode, className: 'text-blue-400' },
        'scss': { icon: PiFileCode, className: 'text-pink-400' },
        'sass': { icon: PiFileCode, className: 'text-pink-400' },
        'less': { icon: PiFileCode, className: 'text-indigo-400' },
        'styl': { icon: PiFileCode, className: 'text-green-400' },

        // Data & Config
        'json': { icon: PiGear, className: 'text-yellow-200' },
        'json5': { icon: PiGear, className: 'text-yellow-200' },
        'xml': { icon: PiFileCode, className: 'text-orange-400' },
        'yaml': { icon: PiGear, className: 'text-purple-300' },
        'yml': { icon: PiGear, className: 'text-purple-300' },
        'toml': { icon: PiGear, className: 'text-gray-400' },
        'ini': { icon: PiGear, className: 'text-gray-300' },
        'conf': { icon: PiGear, className: 'text-gray-300' },
        'sql': { icon: PiDatabase, className: 'text-blue-400' },
        'db': { icon: PiDatabase, className: 'text-blue-300' },
        'sqlite': { icon: PiDatabase, className: 'text-blue-300' },
        'prisma': { icon: PiDatabase, className: 'text-teal-400' },
        'graphql': { icon: PiDatabase, className: 'text-pink-500' },
        'gql': { icon: PiDatabase, className: 'text-pink-500' },

        // Programming Languages
        'py': { icon: PiFileCode, className: 'text-blue-300' },
        'pyc': { icon: PiFileCode, className: 'text-gray-500' },
        'pyd': { icon: PiFileCode, className: 'text-gray-500' },
        'ipynb': { icon: PiFileCode, className: 'text-orange-400' },
        'rs': { icon: PiFileCode, className: 'text-orange-500' },
        'go': { icon: PiFileCode, className: 'text-cyan-400' },
        'java': { icon: PiFileCode, className: 'text-red-500' },
        'c': { icon: PiFileCode, className: 'text-blue-600' },
        'cpp': { icon: PiFileCode, className: 'text-blue-500' },
        'h': { icon: PiFileCode, className: 'text-purple-500' },
        'cs': { icon: PiFileCode, className: 'text-purple-500' },
        'php': { icon: PiFileCode, className: 'text-indigo-400' },
        'rb': { icon: PiFileCode, className: 'text-red-500' },
        'lua': { icon: PiFileCode, className: 'text-blue-300' },
        'swift': { icon: PiFileCode, className: 'text-orange-500' },
        'kt': { icon: PiFileCode, className: 'text-purple-500' },
        'dart': { icon: PiFileCode, className: 'text-cyan-500' },

        // Shell/Terminal
        'sh': { icon: PiTerminal, className: 'text-green-500' },
        'bash': { icon: PiTerminal, className: 'text-green-500' },
        'zsh': { icon: PiTerminal, className: 'text-green-500' },
        'fish': { icon: PiTerminal, className: 'text-green-500' },
        'bat': { icon: PiTerminal, className: 'text-gray-300' },
        'ps1': { icon: PiTerminal, className: 'text-blue-300' },

        // Documentation
        'md': { icon: PiFileText, className: 'text-blue-300' },
        'mdx': { icon: PiFileText, className: 'text-blue-400' },
        'txt': { icon: PiFileText, className: 'text-gray-400' },
        'pdf': { icon: PiFileText, className: 'text-red-400' },
        'doc': { icon: PiFileText, className: 'text-blue-600' },
        'docx': { icon: PiFileText, className: 'text-blue-600' },
        'csv': { icon: PiFileText, className: 'text-green-500' },

        // Media
        'svg': { icon: PiFileImage, className: 'text-orange-400' },
        'png': { icon: PiFileImage, className: 'text-purple-400' },
        'jpg': { icon: PiFileImage, className: 'text-purple-400' },
        'jpeg': { icon: PiFileImage, className: 'text-purple-400' },
        'gif': { icon: PiFileImage, className: 'text-purple-400' },
        'webp': { icon: PiFileImage, className: 'text-purple-400' },
        'ico': { icon: PiFileImage, className: 'text-yellow-500' },
        'mp3': { icon: PiFileAudio, className: 'text-pink-400' },
        'wav': { icon: PiFileAudio, className: 'text-pink-400' },
        'mp4': { icon: PiFileVideo, className: 'text-red-400' },
        'webm': { icon: PiFileVideo, className: 'text-red-400' },
        'mov': { icon: PiFileVideo, className: 'text-red-400' },

        // Archives
        'zip': { icon: PiFileZip, className: 'text-yellow-600' },
        'tar': { icon: PiFileZip, className: 'text-yellow-600' },
        'gz': { icon: PiFileZip, className: 'text-yellow-600' },
        'rar': { icon: PiFileZip, className: 'text-yellow-600' },
        '7z': { icon: PiFileZip, className: 'text-yellow-600' },

        // Fonts
        'ttf': { icon: PiFileText, className: 'text-gray-400' },
        'otf': { icon: PiFileText, className: 'text-gray-400' },
        'woff': { icon: PiFileText, className: 'text-gray-400' },
        'woff2': { icon: PiFileText, className: 'text-gray-400' },
    };

    const iconEntry = iconMap[extension];

    if (iconEntry) {
        const { icon: Icon, className } = iconEntry;
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    return <PiFile className="w-4 h-4 shrink-0 text-muted-foreground" />;
}
