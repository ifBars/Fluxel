/**
 * Inspector Message Protocol
 * Type-safe message definitions for communication between parent window and preview iframe.
 */

// ============================================================================
// Element Data Types
// ============================================================================

/**
 * Source location in the codebase - used for mapping DOM elements to source files
 */
export interface SourceLocation {
    file: string;
    line: number;
    column: number;
    componentName?: string;
}

/**
 * Bounding rectangle information for element positioning
 */
export interface ElementRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Minimal element info for hover state
 */
export interface HoveredElement {
    selector: string;
    tagName: string;
    classList: string[];
    id: string;
    rect: ElementRect;
}

/**
 * Full element info for selected state
 */
export interface SelectedElement extends HoveredElement {
    textContent: string | null;
    isTextEditable: boolean;
    textEditReason?: 'binding-attribute' | 'dynamic-mutation' | 'binding-context' | 'not-text-element';
    computedStyles: Record<string, string>;
    sourceLocation?: SourceLocation;
    // Data attributes for source mapping
    sourcePath?: string;      // data-source-path
    componentId?: string;     // data-component-id
    propName?: string;        // data-prop-name
}

/**
 * Element node for component tree
 */
export interface ElementNode {
    id: string;
    selector: string;
    tagName: string;
    classList: string[];
    elementId: string;
    children: ElementNode[];
    depth: number;
    isExpanded?: boolean;
}

/**
 * Style change to apply
 */
export interface StyleChange {
    selector: string;
    property: string;
    value: string;
    unit?: string;
}

/**
 * Text change to apply
 */
export interface TextChange {
    selector: string;
    text: string;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Messages sent FROM iframe TO parent
 */
export type IframeToParentMessage =
    | { type: 'inspector:ready' }
    | { type: 'element:hover'; payload: HoveredElement | null }
    | { type: 'element:select'; payload: SelectedElement }
    | { type: 'element:deselect' }
    | { type: 'tree:update'; payload: ElementNode[] }
    | { type: 'text:changed'; payload: TextChange }
    | { type: 'style:changed'; payload: StyleChange };

/**
 * Messages sent FROM parent TO iframe
 */
export type ParentToIframeMessage =
    | { type: 'inspector:enable' }
    | { type: 'inspector:disable' }
    | { type: 'element:highlight'; payload: { selector: string } | null }
    | { type: 'style:apply'; payload: StyleChange }
    | { type: 'style:apply-batch'; payload: StyleChange[] }
    | { type: 'text:edit-start'; payload: { selector: string } }
    | { type: 'text:edit-end' }
    | { type: 'text:apply'; payload: TextChange }
    | { type: 'tree:request' };

/**
 * Union of all message types
 */
export type InspectorMessage = IframeToParentMessage | ParentToIframeMessage;

// ============================================================================
// Message Helpers
// ============================================================================

const INSPECTOR_MESSAGE_PREFIX = 'fluxel-inspector:';

/**
 * Send a message from parent to iframe
 */
export function sendToIframe(
    iframe: HTMLIFrameElement,
    message: ParentToIframeMessage
): void {
    if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(
            { ...message, __source: INSPECTOR_MESSAGE_PREFIX },
            '*'
        );
    }
}

/**
 * Send a message from iframe to parent
 */
export function sendToParent(message: IframeToParentMessage): void {
    window.parent.postMessage(
        { ...message, __source: INSPECTOR_MESSAGE_PREFIX },
        '*'
    );
}

/**
 * Check if a message is from our inspector system
 */
export function isInspectorMessage(
    event: MessageEvent
): event is MessageEvent<InspectorMessage & { __source: string }> {
    return (
        event.data &&
        typeof event.data === 'object' &&
        event.data.__source === INSPECTOR_MESSAGE_PREFIX
    );
}

/**
 * Create a unique selector for an element
 */
export function getUniqueSelector(element: Element): string {
    // If element has an ID, use it
    if (element.id) {
        return `#${element.id}`;
    }

    // Build path from element to root
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();

        // Add classes (limit to first 2 for readability)
        if (current.classList.length > 0) {
            const classes = Array.from(current.classList).slice(0, 2);
            selector += '.' + classes.join('.');
        }

        // Add nth-child if needed for uniqueness
        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(
                (child) => child.tagName === current!.tagName
            );
            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
            }
        }

        path.unshift(selector);
        current = current.parentElement;
    }

    return path.join(' > ');
}

/**
 * Extract source location from data attributes
 */
export function extractSourceLocation(element: Element): SourceLocation | undefined {
    const sourcePath = element.getAttribute('data-source-path');
    const line = element.getAttribute('data-source-line');
    const column = element.getAttribute('data-source-column');
    const componentName = element.getAttribute('data-component-id');

    if (sourcePath && line) {
        return {
            file: sourcePath,
            line: parseInt(line, 10),
            column: column ? parseInt(column, 10) : 0,
            componentName: componentName || undefined,
        };
    }

    return undefined;
}
