import {
    MdInsertDriveFile,
    MdCode,
    MdImage,
    MdDescription,
    MdSettings,
    MdLock,
    MdMovie,
    MdMusicNote,
    MdCompress,
    MdFontDownload,
    MdTerminal,
    MdExtension
} from 'react-icons/md';
import {
    SiTypescript,
    SiJavascript,
    SiReact,
    SiHtml5,
    SiCss3,
    SiSass,
    SiLess,
    SiStylus,
    SiJson,
    SiRust,
    SiGo,
    SiPython,
    SiSharp,
    SiCplusplus,
    SiMarkdown,
    SiDocker,
    SiGit,
    SiYarn,
    SiNpm,
    SiVite,
    SiTailwindcss,
    SiPostcss,
    SiEslint,
    SiBun,
    SiPnpm,
    SiComposer,
    SiRubygems,
    SiDart,
    SiKotlin,
    SiSwift,
    SiPhp,
    SiLua,
    SiGnubash,
    SiPowers,
    SiGraphql,
    SiPrisma,
    SiPostgresql,
    SiSqlite,
    SiVercel,
    SiNextdotjs,
    SiAstro,
    SiSvelte,
    SiVuedotjs
} from 'react-icons/si';
import type { IconType } from 'react-icons';
import { ReactNode } from 'react';

export function getReactIconsFileIcon(name: string, extension: string): ReactNode {
    const normalizedName = name.toLowerCase();

    // Specific filenames have highest priority
    const specialFiles: Record<string, { icon: IconType; className: string }> = {
        // Build & Package Managers
        'package.json': { icon: SiNpm, className: 'text-red-500' },
        'package-lock.json': { icon: SiNpm, className: 'text-red-400' },
        'bun.lock': { icon: SiBun, className: 'text-orange-200' },
        'bun.lockb': { icon: SiBun, className: 'text-orange-200' },
        'pnpm-lock.yaml': { icon: SiPnpm, className: 'text-orange-400' },
        'yarn.lock': { icon: SiYarn, className: 'text-blue-400' },
        'composer.json': { icon: SiComposer, className: 'text-amber-600' },
        'composer.lock': { icon: SiComposer, className: 'text-amber-600' },
        'cargo.toml': { icon: SiRust, className: 'text-orange-700' }, // Rust crate
        'cargo.lock': { icon: SiRust, className: 'text-orange-700' },
        'gemfile': { icon: SiRubygems, className: 'text-red-500' },
        'gemfile.lock': { icon: SiRubygems, className: 'text-red-500' },

        // Config Files
        'tsconfig.json': { icon: SiTypescript, className: 'text-blue-500' },
        'jsconfig.json': { icon: SiJavascript, className: 'text-yellow-400' },
        'vite.config.ts': { icon: SiVite, className: 'text-purple-400' },
        'vite.config.js': { icon: SiVite, className: 'text-purple-400' },
        'next.config.js': { icon: SiNextdotjs, className: 'text-white' },
        'next.config.mjs': { icon: SiNextdotjs, className: 'text-white' },
        'next.config.ts': { icon: SiNextdotjs, className: 'text-white' },
        'tailwind.config.js': { icon: SiTailwindcss, className: 'text-cyan-400' },
        'tailwind.config.ts': { icon: SiTailwindcss, className: 'text-cyan-400' },
        'postcss.config.js': { icon: SiPostcss, className: 'text-pink-400' },
        'eslint.config.js': { icon: SiEslint, className: 'text-purple-400' },
        '.eslintrc': { icon: SiEslint, className: 'text-purple-400' },
        '.eslintrc.json': { icon: SiEslint, className: 'text-purple-400' },
        '.eslintrc.js': { icon: SiEslint, className: 'text-purple-400' },
        '.gitignore': { icon: SiGit, className: 'text-orange-500' },
        '.gitattributes': { icon: SiGit, className: 'text-orange-500' },
        '.env': { icon: MdLock, className: 'text-emerald-400' },
        '.env.local': { icon: MdLock, className: 'text-emerald-400' },
        '.env.development': { icon: MdLock, className: 'text-emerald-400' },
        '.env.production': { icon: MdLock, className: 'text-emerald-400' },
        '.env.example': { icon: MdLock, className: 'text-emerald-400' },
        'dockerfile': { icon: SiDocker, className: 'text-blue-500' },
        'docker-compose.yml': { icon: SiDocker, className: 'text-blue-500' },
        'docker-compose.yaml': { icon: SiDocker, className: 'text-blue-500' },
        'readme.md': { icon: SiMarkdown, className: 'text-blue-400' },
        'license': { icon: MdDescription, className: 'text-yellow-500' },
        'license.md': { icon: MdDescription, className: 'text-yellow-500' },
        'vercel.json': { icon: SiVercel, className: 'text-white' },

        // System
        'favicon.ico': { icon: MdImage, className: 'text-yellow-200' },
    };

    if (specialFiles[normalizedName]) {
        const { icon: Icon, className } = specialFiles[normalizedName];
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    const iconMap: Record<string, { icon: IconType; className: string }> = {
        // Web - Scripts
        'ts': { icon: SiTypescript, className: 'text-blue-500' },
        'tsx': { icon: SiReact, className: 'text-blue-400' }, // Often TSX is React
        'js': { icon: SiJavascript, className: 'text-yellow-400' },
        'jsx': { icon: SiReact, className: 'text-yellow-300' },
        'mjs': { icon: SiJavascript, className: 'text-yellow-400' },
        'cjs': { icon: SiJavascript, className: 'text-yellow-400' },
        'vue': { icon: SiVuedotjs, className: 'text-emerald-400' },
        'svelte': { icon: SiSvelte, className: 'text-orange-500' },
        'astro': { icon: SiAstro, className: 'text-orange-500' },

        // Web - Styles/Structure
        'html': { icon: SiHtml5, className: 'text-orange-500' },
        'htm': { icon: SiHtml5, className: 'text-orange-500' },
        'css': { icon: SiCss3, className: 'text-blue-400' },
        'scss': { icon: SiSass, className: 'text-pink-400' },
        'sass': { icon: SiSass, className: 'text-pink-400' },
        'less': { icon: SiLess, className: 'text-indigo-400' },
        'styl': { icon: SiStylus, className: 'text-green-400' },

        // Data & Config
        'json': { icon: SiJson, className: 'text-yellow-200' },
        'json5': { icon: SiJson, className: 'text-yellow-200' },
        'xml': { icon: MdCode, className: 'text-orange-400' },
        'yaml': { icon: MdSettings, className: 'text-purple-300' },
        'yml': { icon: MdSettings, className: 'text-purple-300' },
        'toml': { icon: MdSettings, className: 'text-gray-400' },
        'ini': { icon: MdSettings, className: 'text-gray-300' },
        'conf': { icon: MdSettings, className: 'text-gray-300' },
        'sql': { icon: SiPostgresql, className: 'text-blue-400' },
        'db': { icon: SiSqlite, className: 'text-blue-300' },
        'sqlite': { icon: SiSqlite, className: 'text-blue-300' },
        'prisma': { icon: SiPrisma, className: 'text-teal-400' },
        'graphql': { icon: SiGraphql, className: 'text-pink-500' },
        'gql': { icon: SiGraphql, className: 'text-pink-500' },

        // Programming Languages
        'py': { icon: SiPython, className: 'text-blue-300' },
        'pyc': { icon: SiPython, className: 'text-gray-500' },
        'pyd': { icon: SiPython, className: 'text-gray-500' },
        'ipynb': { icon: SiPython, className: 'text-orange-400' },
        'rs': { icon: SiRust, className: 'text-orange-500' },
        'go': { icon: SiGo, className: 'text-cyan-400' },
        'java': { icon: MdCode, className: 'text-red-500' },
        'c': { icon: MdCode, className: 'text-blue-600' },
        'cpp': { icon: SiCplusplus, className: 'text-blue-500' },
        'h': { icon: MdCode, className: 'text-purple-500' },
        'cs': { icon: SiSharp, className: 'text-purple-500' },
        'php': { icon: SiPhp, className: 'text-indigo-400' },
        'rb': { icon: SiRubygems, className: 'text-red-500' },
        'lua': { icon: SiLua, className: 'text-blue-300' },
        'swift': { icon: SiSwift, className: 'text-orange-500' },
        'kt': { icon: SiKotlin, className: 'text-purple-500' },
        'dart': { icon: SiDart, className: 'text-cyan-500' },

        // Shell/Terminal
        'sh': { icon: SiGnubash, className: 'text-green-500' },
        'bash': { icon: SiGnubash, className: 'text-green-500' },
        'zsh': { icon: MdTerminal, className: 'text-green-500' },
        'fish': { icon: MdTerminal, className: 'text-green-500' },
        'bat': { icon: MdTerminal, className: 'text-gray-300' },
        'ps1': { icon: SiPowers, className: 'text-blue-300' },

        // Documentation
        'md': { icon: SiMarkdown, className: 'text-blue-300' },
        'mdx': { icon: SiMarkdown, className: 'text-blue-400' },
        'txt': { icon: MdDescription, className: 'text-gray-400' },
        'pdf': { icon: MdDescription, className: 'text-red-400' },
        'doc': { icon: MdDescription, className: 'text-blue-600' },
        'docx': { icon: MdDescription, className: 'text-blue-600' },
        'csv': { icon: MdExtension, className: 'text-green-500' },

        // Media
        'svg': { icon: MdImage, className: 'text-orange-400' },
        'png': { icon: MdImage, className: 'text-purple-400' },
        'jpg': { icon: MdImage, className: 'text-purple-400' },
        'jpeg': { icon: MdImage, className: 'text-purple-400' },
        'gif': { icon: MdImage, className: 'text-purple-400' },
        'webp': { icon: MdImage, className: 'text-purple-400' },
        'ico': { icon: MdImage, className: 'text-yellow-500' },
        'mp3': { icon: MdMusicNote, className: 'text-pink-400' },
        'wav': { icon: MdMusicNote, className: 'text-pink-400' },
        'mp4': { icon: MdMovie, className: 'text-red-400' },
        'webm': { icon: MdMovie, className: 'text-red-400' },
        'mov': { icon: MdMovie, className: 'text-red-400' },

        // Archives
        'zip': { icon: MdCompress, className: 'text-yellow-600' },
        'tar': { icon: MdCompress, className: 'text-yellow-600' },
        'gz': { icon: MdCompress, className: 'text-yellow-600' },
        'rar': { icon: MdCompress, className: 'text-yellow-600' },
        '7z': { icon: MdCompress, className: 'text-yellow-600' },

        // Fonts
        'ttf': { icon: MdFontDownload, className: 'text-gray-400' },
        'otf': { icon: MdFontDownload, className: 'text-gray-400' },
        'woff': { icon: MdFontDownload, className: 'text-gray-400' },
        'woff2': { icon: MdFontDownload, className: 'text-gray-400' },
    };

    const iconEntry = iconMap[extension];

    if (iconEntry) {
        const { icon: Icon, className } = iconEntry;
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    return <MdInsertDriveFile className="w-4 h-4 shrink-0 text-muted-foreground" />;
}
