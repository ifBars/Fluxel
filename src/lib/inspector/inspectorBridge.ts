/**
 * Inspector Bridge Script
 * 
 * This script is injected into the preview iframe to enable element selection,
 * hovering, and real-time style manipulation. It communicates with the parent
 * window via postMessage.
 */

import type {
    HoveredElement,
    SelectedElement,
    ElementNode,
    StyleChange,
    TextChange,
    ParentToIframeMessage,
    SourceLocation,
} from './inspectorMessages';
import {
    sendToParent,
    isInspectorMessage,
    getUniqueSelector,
    extractSourceLocation,
} from './inspectorMessages';

// ============================================================================
// Constants
// ============================================================================

// Racing Orange from design_system.md
const HIGHLIGHT_COLOR = 'oklch(62% 0.22 50)';
const HIGHLIGHT_BG = 'oklch(62% 0.22 50 / 0.1)';
const SELECTION_BG = 'oklch(62% 0.22 50 / 0.2)';

// ============================================================================
// Overlay Management
// ============================================================================

let hoverOverlay: HTMLDivElement | null = null;
let selectionOverlay: HTMLDivElement | null = null;
let labelElement: HTMLDivElement | null = null;
let selectedElement: Element | null = null;
let isInspectorEnabled = false;

function createOverlay(type: 'hover' | 'selection'): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 999999;
        border: 2px solid ${HIGHLIGHT_COLOR};
        background: ${type === 'selection' ? SELECTION_BG : HIGHLIGHT_BG};
        transition: all 0.1s ease-out;
        box-sizing: border-box;
    `;
    overlay.dataset.inspectorOverlay = type;
    return overlay;
}

function createLabel(): HTMLDivElement {
    const label = document.createElement('div');
    label.style.cssText = `
        position: fixed;
        z-index: 1000000;
        pointer-events: none;
        background: ${HIGHLIGHT_COLOR};
        color: white;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 11px;
        font-weight: 500;
        padding: 2px 6px;
        border-radius: 2px;
        white-space: nowrap;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
    `;
    label.dataset.inspectorLabel = 'true';
    return label;
}

function positionOverlay(overlay: HTMLDivElement, rect: DOMRect): void {
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
}

function positionLabel(label: HTMLDivElement, rect: DOMRect): void {
    // Position label above the element, or below if not enough space
    const labelHeight = 20;
    const padding = 4;

    if (rect.top > labelHeight + padding) {
        label.style.top = `${rect.top - labelHeight - padding}px`;
    } else {
        label.style.top = `${rect.bottom + padding}px`;
    }
    label.style.left = `${rect.left}px`;
}

function getLabelText(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const classes = Array.from(element.classList).slice(0, 3).join('.');
    const id = element.id ? `#${element.id}` : '';
    return `${tag}${id}${classes ? '.' + classes : ''}`;
}

function showHoverOverlay(element: Element): void {
    if (!hoverOverlay) {
        hoverOverlay = createOverlay('hover');
        document.body.appendChild(hoverOverlay);
    }
    if (!labelElement) {
        labelElement = createLabel();
        document.body.appendChild(labelElement);
    }

    const rect = element.getBoundingClientRect();
    positionOverlay(hoverOverlay, rect);
    positionLabel(labelElement, rect);
    labelElement.textContent = getLabelText(element);

    hoverOverlay.style.display = 'block';
    labelElement.style.display = 'block';
}

function hideHoverOverlay(): void {
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    if (labelElement) labelElement.style.display = 'none';
}

function showSelectionOverlay(element: Element): void {
    if (!selectionOverlay) {
        selectionOverlay = createOverlay('selection');
        document.body.appendChild(selectionOverlay);
    }

    const rect = element.getBoundingClientRect();
    positionOverlay(selectionOverlay, rect);
    selectionOverlay.style.display = 'block';
}

function hideSelectionOverlay(): void {
    if (selectionOverlay) selectionOverlay.style.display = 'none';
}

function updateOverlays(): void {
    if (selectedElement && isInspectorEnabled) {
        const rect = selectedElement.getBoundingClientRect();
        if (selectionOverlay) positionOverlay(selectionOverlay, rect);
    }
}

// ============================================================================
// Element Data Extraction
// ============================================================================

function getComputedStylesSubset(element: Element): Record<string, string> {
    const computed = window.getComputedStyle(element);
    const relevantProps = [
        // Position
        'position', 'left', 'top', 'right', 'bottom', 'z-index',
        // Layout
        'display', 'flex-direction', 'justify-content', 'align-items', 'gap',
        'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
        // Spacing
        'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        // Appearance
        'opacity', 'border-radius', 'background-color', 'background',
        'border', 'border-width', 'border-color', 'border-style',
        'box-shadow',
        // Typography
        'font-family', 'font-size', 'font-weight', 'line-height', 'color',
        'text-align', 'letter-spacing',
    ];

    const styles: Record<string, string> = {};
    for (const prop of relevantProps) {
        styles[prop] = computed.getPropertyValue(prop);
    }
    return styles;
}

function isTextEditable(element: Element): boolean {
    // Check if element contains only text (no child elements with text)
    const hasOnlyTextChildren = Array.from(element.childNodes).every(
        (node) => node.nodeType === Node.TEXT_NODE
    );

    // Check if it's a typical text container element
    const textElements = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'LABEL', 'LI', 'TD', 'TH'];

    return hasOnlyTextChildren && textElements.includes(element.tagName);
}

function createHoveredElement(element: Element): HoveredElement {
    const rect = element.getBoundingClientRect();
    return {
        selector: getUniqueSelector(element),
        tagName: element.tagName.toLowerCase(),
        classList: Array.from(element.classList),
        id: element.id,
        rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        },
    };
}

// ============================================================================
// React Fiber Extraction
// ============================================================================

function getReactFiber(element: Element): any {
    // React 17+ uses __reactFiber$ prefix
    const key = Object.keys(element).find(k => k.startsWith('__reactFiber$'));
    return key ? (element as any)[key] : null;
}

function extractSourceFromFiber(element: Element): SourceLocation | undefined {
    let fiber = getReactFiber(element);
    if (!fiber) return undefined;

    // The current fiber usually represents the host element (div, span, etc.)
    // Its _debugSource property point to the JSX site where it was created.

    // We try to find the nearest source info
    while (fiber) {
        if (fiber._debugSource) {
            return {
                file: fiber._debugSource.fileName,
                line: fiber._debugSource.lineNumber,
                column: 0,
                componentName: typeof fiber.type === 'string' ? fiber.type : (fiber.type?.displayName || fiber.type?.name)
            };
        }
        // If not found, go to parent
        fiber = fiber.return;
    }

    return undefined;
}

function createSelectedElement(element: Element): SelectedElement {
    const hovered = createHoveredElement(element);
    // Try data attributes first (if manually instrumented)
    let sourceLocation = extractSourceLocation(element);

    // Fallback to React Fiber extraction
    if (!sourceLocation) {
        sourceLocation = extractSourceFromFiber(element);
    }

    return {
        ...hovered,
        textContent: isTextEditable(element) ? element.textContent : null,
        isTextEditable: isTextEditable(element),
        computedStyles: getComputedStylesSubset(element),
        sourceLocation,
        sourcePath: element.getAttribute('data-source-path') ?? undefined,
        componentId: element.getAttribute('data-component-id') ?? undefined,
        propName: element.getAttribute('data-prop-name') ?? undefined,
    };
}

// ============================================================================
// Component Tree Building
// ============================================================================

let nodeIdCounter = 0;

function buildElementNode(element: Element, depth: number = 0, maxDepth: number = 10): ElementNode | null {
    // Skip inspector overlays and script/style elements
    if (
        element.hasAttribute('data-inspector-overlay') ||
        element.hasAttribute('data-inspector-label') ||
        ['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(element.tagName)
    ) {
        return null;
    }

    if (depth > maxDepth) return null;

    const children: ElementNode[] = [];
    if (depth < maxDepth) {
        for (const child of Array.from(element.children)) {
            const childNode = buildElementNode(child, depth + 1, maxDepth);
            if (childNode) children.push(childNode);
        }
    }

    nodeIdCounter++;
    return {
        id: `node-${nodeIdCounter}`,
        selector: getUniqueSelector(element),
        tagName: element.tagName.toLowerCase(),
        classList: Array.from(element.classList),
        elementId: element.id,
        children,
        depth,
    };
}

function buildComponentTree(): ElementNode[] {
    nodeIdCounter = 0;
    const rootNode = buildElementNode(document.body, 0, 8);
    return rootNode ? [rootNode] : [];
}

// ============================================================================
// Event Handlers
// ============================================================================

function handleMouseMove(event: MouseEvent): void {
    if (!isInspectorEnabled) return;

    const target = event.target as Element;
    if (!target || target === document.body || target === document.documentElement) {
        hideHoverOverlay();
        sendToParent({ type: 'element:hover', payload: null });
        return;
    }

    // Don't highlight our own overlays
    if (target.hasAttribute('data-inspector-overlay') || target.hasAttribute('data-inspector-label')) {
        return;
    }

    // Don't highlight selected element
    if (target === selectedElement) {
        hideHoverOverlay();
        return;
    }

    showHoverOverlay(target);
    sendToParent({ type: 'element:hover', payload: createHoveredElement(target) });
}

function handleClick(event: MouseEvent): void {
    if (!isInspectorEnabled) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target as Element;
    if (!target || target.hasAttribute('data-inspector-overlay') || target.hasAttribute('data-inspector-label')) {
        return;
    }

    // Update selection
    selectedElement = target;
    hideHoverOverlay();
    showSelectionOverlay(target);

    sendToParent({ type: 'element:select', payload: createSelectedElement(target) });
}

function handleScroll(): void {
    updateOverlays();
}

function handleResize(): void {
    updateOverlays();
}

// ============================================================================
// Message Handler
// ============================================================================

function handleParentMessage(message: ParentToIframeMessage): void {
    switch (message.type) {
        case 'inspector:enable':
            isInspectorEnabled = true;
            document.body.style.cursor = 'crosshair';
            // Send initial tree
            sendToParent({ type: 'tree:update', payload: buildComponentTree() });
            break;

        case 'inspector:disable':
            isInspectorEnabled = false;
            document.body.style.cursor = '';
            hideHoverOverlay();
            hideSelectionOverlay();
            selectedElement = null;
            break;

        case 'style:apply':
            applyStyle(message.payload);
            break;

        case 'style:apply-batch':
            for (const change of message.payload) {
                applyStyle(change);
            }
            break;

        case 'text:apply':
            applyText(message.payload);
            break;

        case 'tree:request':
            sendToParent({ type: 'tree:update', payload: buildComponentTree() });
            break;

        case 'element:highlight':
            if (message.payload) {
                const el = document.querySelector(message.payload.selector);
                if (el) {
                    showSelectionOverlay(el);
                    selectedElement = el;
                }
            } else {
                hideSelectionOverlay();
                selectedElement = null;
            }
            break;
    }
}

// ============================================================================
// Style/Text Application
// ============================================================================

function applyStyle(change: StyleChange): void {
    const element = document.querySelector(change.selector);
    if (!element || !(element instanceof HTMLElement)) return;

    const value = change.unit ? `${change.value}${change.unit}` : change.value;
    element.style.setProperty(change.property, value);

    // Notify parent of the change
    sendToParent({ type: 'style:changed', payload: change });

    // Update overlay position if style affects layout
    updateOverlays();
}

function applyText(change: TextChange): void {
    const element = document.querySelector(change.selector);
    if (!element) return;

    element.textContent = change.text;
    sendToParent({ type: 'text:changed', payload: change });
}

// ============================================================================
// Initialization
// ============================================================================

function init(): void {
    // Set up event listeners
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    // Listen for messages from parent
    window.addEventListener('message', (event) => {
        if (isInspectorMessage(event)) {
            handleParentMessage(event.data as ParentToIframeMessage);
        }
    });

    // Notify parent that bridge is ready
    sendToParent({ type: 'inspector:ready' });
}

// Auto-init when script loads
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

// Export for potential direct usage
export { init as initInspectorBridge };
