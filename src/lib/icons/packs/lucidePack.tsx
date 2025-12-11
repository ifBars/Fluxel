import {
    File,
    FileCode,
    FileJson,
    FileType,
    FileImage,
    FileText,
    FileVideo,
    FileMusic,
    FileArchive,
    Terminal,
    Box,
    Globe,
    Database,
    Lock,
    Book
} from 'lucide-react';
import { ReactNode } from 'react';

export function getLucideFileIcon(name: string, extension: string): ReactNode {
    const className = "w-4 h-4 shrink-0 text-muted-foreground";
    const normalizedName = name.toLowerCase();

    // Specific files
    if (normalizedName === 'package.json') return <Box className="w-4 h-4 shrink-0 text-red-500" />;
    if (normalizedName.includes('docker')) return <Box className="w-4 h-4 shrink-0 text-blue-500" />;
    if (normalizedName === 'readme.md') return <Book className="w-4 h-4 shrink-0 text-blue-400" />;

    // Extensions
    switch (extension) {
        // Code
        case 'ts':
        case 'tsx':
        case 'js':
        case 'jsx':
            return <FileCode className="w-4 h-4 shrink-0 text-blue-400" />;
        case 'css':
        case 'scss':
        case 'less':
            return <FileType className="w-4 h-4 shrink-0 text-blue-300" />;
        case 'html':
            return <Globe className="w-4 h-4 shrink-0 text-orange-400" />;
        case 'json':
        case 'yaml':
        case 'yml':
        case 'toml':
            return <FileJson className="w-4 h-4 shrink-0 text-yellow-400" />;

        // Data
        case 'sql':
        case 'prisma':
        case 'db':
        case 'sqlite':
            return <Database className="w-4 h-4 shrink-0 text-teal-400" />;

        // Images/Media
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
        case 'webp':
        case 'ico':
            return <FileImage className="w-4 h-4 shrink-0 text-purple-400" />;
        case 'mp4':
        case 'mov':
        case 'webm':
            return <FileVideo className="w-4 h-4 shrink-0 text-red-400" />;
        case 'mp3':
        case 'wav':
            return <FileMusic className="w-4 h-4 shrink-0 text-pink-400" />;

        // System/Config
        case 'env':
            return <Lock className="w-4 h-4 shrink-0 text-emerald-400" />;
        case 'sh':
        case 'bash':
        case 'zsh':
            return <Terminal className="w-4 h-4 shrink-0 text-green-400" />;

        // Archives
        case 'zip':
        case 'tar':
        case 'gz':
        case 'rar':
            return <FileArchive className="w-4 h-4 shrink-0 text-orange-400" />;

        case 'md':
        case 'txt':
            return <FileText className={className} />;

        default:
            return <File className={className} />;
    }
}
