import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface MarkdownPreviewProps {
    /** The markdown content to render */
    content: string;
    /** The filename being previewed */
    filename?: string;
}

export default function MarkdownPreview({ content, filename }: MarkdownPreviewProps) {
    // Show placeholder when no content
    if (!content || content.trim().length === 0) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-background text-foreground">
                <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Markdown Preview</h3>
                    <p className="text-muted-foreground text-center max-w-xs">
                        Start typing in the editor to see your markdown rendered here.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-background">
            {/* Preview Header */}
            <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-muted/20 shrink-0">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                        {filename || 'Markdown Preview'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground">Live</span>
                </div>
            </div>

            {/* Markdown Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-8 py-6">
                    <article className="prose prose-neutral dark:prose-invert max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                                // Custom component renderers for better styling
                                h1: ({ children }) => (
                                    <h1 className="text-4xl font-bold mb-4 mt-8 first:mt-0 border-b border-border pb-2">
                                        {children}
                                    </h1>
                                ),
                                h2: ({ children }) => (
                                    <h2 className="text-3xl font-semibold mb-3 mt-6 border-b border-border pb-2">
                                        {children}
                                    </h2>
                                ),
                                h3: ({ children }) => (
                                    <h3 className="text-2xl font-semibold mb-2 mt-5">{children}</h3>
                                ),
                                h4: ({ children }) => (
                                    <h4 className="text-xl font-semibold mb-2 mt-4">{children}</h4>
                                ),
                                h5: ({ children }) => (
                                    <h5 className="text-lg font-semibold mb-2 mt-3">{children}</h5>
                                ),
                                h6: ({ children }) => (
                                    <h6 className="text-base font-semibold mb-2 mt-3">{children}</h6>
                                ),
                                p: ({ children }) => (
                                    <p className="mb-4 leading-7 text-foreground">{children}</p>
                                ),
                                a: ({ href, children }) => (
                                    <a
                                        href={href}
                                        className="text-primary hover:underline"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {children}
                                    </a>
                                ),
                                code: ({ className, children }) => {
                                    const isInline = !className;
                                    if (isInline) {
                                        return (
                                            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                                                {children}
                                            </code>
                                        );
                                    }
                                    return (
                                        <code className={className}>
                                            {children}
                                        </code>
                                    );
                                },
                                pre: ({ children }) => (
                                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 border border-border">
                                        {children}
                                    </pre>
                                ),
                                blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
                                        {children}
                                    </blockquote>
                                ),
                                ul: ({ children }) => (
                                    <ul className="list-disc list-inside mb-4 space-y-2">{children}</ul>
                                ),
                                ol: ({ children }) => (
                                    <ol className="list-decimal list-inside mb-4 space-y-2">{children}</ol>
                                ),
                                li: ({ children }) => (
                                    <li className="leading-7">{children}</li>
                                ),
                                table: ({ children }) => (
                                    <div className="overflow-x-auto mb-4">
                                        <table className="min-w-full border-collapse border border-border">
                                            {children}
                                        </table>
                                    </div>
                                ),
                                thead: ({ children }) => (
                                    <thead className="bg-muted">{children}</thead>
                                ),
                                th: ({ children }) => (
                                    <th className="border border-border px-4 py-2 text-left font-semibold">
                                        {children}
                                    </th>
                                ),
                                td: ({ children }) => (
                                    <td className="border border-border px-4 py-2">{children}</td>
                                ),
                                hr: () => <hr className="my-6 border-border" />,
                                img: ({ src, alt }) => (
                                    <img
                                        src={src}
                                        alt={alt}
                                        className="max-w-full h-auto rounded-lg my-4"
                                    />
                                ),
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </article>
                </div>
            </div>
        </div>
    );
}
