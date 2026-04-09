import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { FileCode2, Hash, Layers3, PanelTop, Plus, Type, X } from 'lucide-react';

import type { NewFileTemplate } from '@/lib/plugins/types';
import { ensureTemplateFileName } from '@/lib/workspace/newFileTemplates';
import { cn } from '@/lib/utils';

interface NewFileDialogProps {
    isOpen: boolean;
    parentLabel: string;
    templates: NewFileTemplate[];
    onClose: () => void;
    onCreate: (template: NewFileTemplate, fileName: string) => Promise<void>;
}

function getTemplateIcon(template: NewFileTemplate): ReactNode {
    const label = template.label.toLowerCase();

    if (label.includes('interface')) {
        return <Layers3 size={14} />;
    }

    if (label.includes('enum')) {
        return <Hash size={14} />;
    }

    if (label.includes('react') || label.includes('phone app')) {
        return <PanelTop size={14} />;
    }

    if (label.includes('class') || label.includes('record') || label.includes('struct') || label.includes('npc')) {
        return <Type size={14} />;
    }

    return <FileCode2 size={14} />;
}

function NewFileDialog({
    isOpen,
    parentLabel,
    templates,
    onClose,
    onCreate,
}: NewFileDialogProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedTemplate = useMemo(() => {
        return templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null;
    }, [selectedTemplateId, templates]);

    const groupedTemplates = useMemo(() => {
        const groups = new Map<string, NewFileTemplate[]>();

        for (const template of templates) {
            const category = template.category ?? 'Templates';
            const current = groups.get(category) ?? [];
            current.push(template);
            groups.set(category, current);
        }

        return Array.from(groups.entries());
    }, [templates]);

    const previewName = useMemo(() => {
        const fallbackName = selectedTemplate?.suggestedBaseName ?? 'newfile';
        return ensureTemplateFileName(name.trim() || fallbackName, selectedTemplate?.extension);
    }, [name, selectedTemplate]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const initialTemplate = templates[0] ?? null;
        setSelectedTemplateId(initialTemplate?.id ?? null);
        setName(initialTemplate?.suggestedBaseName ?? 'newfile');
        setIsSubmitting(false);
    }, [isOpen, templates]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [isOpen, selectedTemplateId]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isSubmitting) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen || !selectedTemplate) {
        return null;
    }

    const handleTemplateSelect = (template: NewFileTemplate) => {
        setSelectedTemplateId(template.id);
        setName(template.suggestedBaseName ?? 'newfile');
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        const finalName = previewName.trim();
        if (!finalName) {
            return;
        }

        setIsSubmitting(true);

        try {
            await onCreate(selectedTemplate, finalName);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
            <div
                className="absolute inset-0"
                onClick={() => {
                    if (!isSubmitting) {
                        onClose();
                    }
                }}
            />

            <form
                onSubmit={handleSubmit}
                className="relative z-10 w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/70 bg-card/96 shadow-2xl"
            >
                <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-transparent px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary/80">
                                New File
                            </p>
                            <h2 className="text-lg font-semibold text-foreground">Create in {parentLabel}</h2>
                            <p className="text-sm text-muted-foreground">
                                Choose a template that fits this workspace, then name the file.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                            aria-label="Close new file dialog"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.9fr)]">
                    <div className="space-y-4">
                        {groupedTemplates.map(([category, categoryTemplates]) => (
                            <div key={category} className="space-y-2">
                                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    {category}
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {categoryTemplates.map((template) => {
                                        const isSelected = template.id === selectedTemplate.id;

                                        return (
                                            <button
                                                key={template.id}
                                                type="button"
                                                onClick={() => handleTemplateSelect(template)}
                                                className={cn(
                                                    'rounded-xl border px-3 py-3 text-left transition-all',
                                                    isSelected
                                                        ? 'border-primary/60 bg-primary/10 shadow-sm'
                                                        : 'border-border/70 bg-background/70 hover:border-primary/30 hover:bg-muted/70'
                                                )}
                                            >
                                                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                                                    <span
                                                        className={cn(
                                                            'flex h-7 w-7 items-center justify-center rounded-lg border',
                                                            isSelected
                                                                ? 'border-primary/40 bg-primary/15 text-primary'
                                                                : 'border-border/60 bg-muted/70 text-muted-foreground'
                                                        )}
                                                    >
                                                        {getTemplateIcon(template)}
                                                    </span>
                                                    <span>{template.label}</span>
                                                </div>
                                                <p className="text-xs leading-5 text-muted-foreground">
                                                    {template.description ?? 'Create a new file from this template.'}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4 rounded-2xl border border-border/70 bg-background/75 p-4">
                        <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                File Name
                            </p>
                            <label className="block">
                                <span className="sr-only">File name</span>
                                <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/40">
                                    <Plus size={14} className="text-muted-foreground" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={name}
                                        onChange={(event) => setName(event.target.value)}
                                        disabled={isSubmitting}
                                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                        placeholder={selectedTemplate.suggestedBaseName ?? 'newfile'}
                                    />
                                    {selectedTemplate.extension && (
                                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                            .{selectedTemplate.extension}
                                        </span>
                                    )}
                                </div>
                            </label>
                        </div>

                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Preview
                            </p>
                            <p className="mt-2 truncate font-mono text-sm text-foreground">
                                {previewName || 'newfile'}
                            </p>
                        </div>

                        <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background to-muted/25 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Selected Template
                            </p>
                            <p className="mt-2 text-sm font-medium text-foreground">{selectedTemplate.label}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {selectedTemplate.description ?? 'A project-aware starter file.'}
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="rounded-lg border border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !previewName.trim()}
                                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? 'Creating...' : 'Create File'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default memo(NewFileDialog);
