/**
 * Inspector Bridge Script - Inline Version
 * 
 * Self-contained JavaScript to inject into preview iframe.
 * Enables element selection, hovering, and real-time style manipulation.
 * Communicates with parent window via postMessage.
 */

(function () {
    // Prevent double initialization
    if (window.__fluxelInspector) {
        console.log('[Inspector] Already initialized');
        return;
    }
    window.__fluxelInspector = true;

    console.log('[Inspector] Initializing bridge script...');

    // ============================================================================
    // Constants
    // ============================================================================

    const HIGHLIGHT_COLOR = 'oklch(62% 0.22 50)';
    const HIGHLIGHT_BG = 'oklch(62% 0.22 50 / 0.1)';
    const SELECTION_BG = 'oklch(62% 0.22 50 / 0.2)';
    const MESSAGE_PREFIX = 'fluxel-inspector:';

    // ============================================================================
    // State
    // ============================================================================

    let hoverOverlay = null;
    let selectionOverlay = null;
    let labelElement = null;
    let selectedElement = null;
    let isEnabled = false;
    let nodeIdCounter = 0;

    // Track elements with dynamic text content
    const dynamicTextElements = new WeakSet();
    const textMutationHistory = new Map(); // element -> { text, changeCount, lastChange }
    let mutationObserver = null;
    const MUTATION_THRESHOLD = 2; // Mark as dynamic after 2 changes within 5 seconds
    const MUTATION_WINDOW = 5000; // 5 second window
    const MAX_HISTORY_SIZE = 1000; // Limit tracking to prevent memory issues

    // ============================================================================
    // Overlay Management
    // ============================================================================

    function createOverlay(type) {
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

    function createLabel() {
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

    function positionOverlay(overlay, rect) {
        overlay.style.left = rect.left + 'px';
        overlay.style.top = rect.top + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
    }

    function positionLabel(label, rect) {
        const labelHeight = 20;
        const padding = 4;
        if (rect.top > labelHeight + padding) {
            label.style.top = (rect.top - labelHeight - padding) + 'px';
        } else {
            label.style.top = (rect.bottom + padding) + 'px';
        }
        label.style.left = rect.left + 'px';
    }

    function getLabelText(element) {
        const tag = element.tagName.toLowerCase();
        const classes = Array.from(element.classList).slice(0, 3).join('.');
        const id = element.id ? '#' + element.id : '';
        return tag + id + (classes ? '.' + classes : '');
    }

    function showHoverOverlay(element) {
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

    function hideHoverOverlay() {
        if (hoverOverlay) hoverOverlay.style.display = 'none';
        if (labelElement) labelElement.style.display = 'none';
    }

    function showSelectionOverlay(element) {
        if (!selectionOverlay) {
            selectionOverlay = createOverlay('selection');
            document.body.appendChild(selectionOverlay);
        }
        const rect = element.getBoundingClientRect();
        positionOverlay(selectionOverlay, rect);
        selectionOverlay.style.display = 'block';
    }

    function hideSelectionOverlay() {
        if (selectionOverlay) selectionOverlay.style.display = 'none';
    }

    function updateOverlays() {
        if (selectedElement && isEnabled) {
            const rect = selectedElement.getBoundingClientRect();
            if (selectionOverlay) positionOverlay(selectionOverlay, rect);
        }
    }

    // ============================================================================
    // Selector Generation
    // ============================================================================

    function escapeCSSClassName(className) {
        // Escape special characters in CSS class names
        // Characters that need escaping: ! " # $ % & ' ( ) * + , . / : ; < = > ? @ [ \ ] ^ ` { | } ~
        return className.replace(/([!"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~])/g, '\\$1');
    }

    function getUniqueSelector(element) {
        if (element.id) {
            // Escape ID as well
            return '#' + escapeCSSClassName(element.id);
        }

        const path = [];
        let current = element;

        while (current && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();

            if (current.classList.length > 0) {
                const classes = Array.from(current.classList).slice(0, 2);
                // Escape each class name
                const escapedClasses = classes.map(c => escapeCSSClassName(c));
                selector += '.' + escapedClasses.join('.');
            }

            const parent = current.parentElement;
            if (parent) {
                // Use nth-child instead of nth-of-type for compatibility with class selectors
                const siblings = Array.from(parent.children);
                if (siblings.length > 1) {
                    const index = siblings.indexOf(current) + 1;
                    selector += ':nth-child(' + index + ')';
                }
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    // ============================================================================
    // Text Editability Detection
    // ============================================================================

    /**
     * Check if element has data-binding attributes
     */
    function hasBindingAttributes(element) {
        const BINDING_ATTRS = [
            // Vue
            'v-text', 'v-html', 'v-bind', 'v-model',
            // Angular
            'ng-bind', 'ng-bind-html',
            // Generic data binding
            'data-bind', 'data-text', 'data-content',
            // Svelte
            'data-svelte-h'
        ];

        // Check for explicit binding attributes
        for (const attr of BINDING_ATTRS) {
            if (element.hasAttribute(attr)) {
                return true;
            }
        }

        // Check for Angular interpolation in attributes
        for (const attr of element.attributes) {
            if (attr.value && (attr.value.includes('{{') || attr.value.includes('}}'))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if element is within a data-binding context
     */
    function hasBindingContext(element) {
        let current = element.parentElement;
        let depth = 0;

        // Check up to 5 levels up the DOM tree
        while (current && depth < 5) {
            if (hasBindingAttributes(current)) {
                return true;
            }
            current = current.parentElement;
            depth++;
        }

        return false;
    }

    /**
     * Get reason why text is not editable (for better UX messaging)
     */
    function getTextEditReason(element) {
        // Check for non-text elements first
        const hasOnlyTextChildren = Array.from(element.childNodes).every(
            n => n.nodeType === Node.TEXT_NODE ||
                 (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'BR')
        );

        const textElements = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN',
            'A', 'BUTTON', 'LABEL', 'LI', 'TD', 'TH', 'DIV'];

        if (!hasOnlyTextChildren || !textElements.includes(element.tagName)) {
            return 'not-text-element';
        }

        // Check for data-binding attributes
        if (hasBindingAttributes(element)) {
            return 'binding-attribute';
        }

        // Check if text is dynamic (from mutation tracking)
        if (dynamicTextElements.has(element)) {
            return 'dynamic-mutation';
        }

        // Check parent chain for binding contexts
        if (hasBindingContext(element)) {
            return 'binding-context';
        }

        return null; // Text is editable
    }

    // ============================================================================
    // Element Data Extraction
    // ============================================================================

    function getComputedStylesSubset(element) {
        const computed = window.getComputedStyle(element);
        const props = [
            'position', 'left', 'top', 'right', 'bottom', 'z-index',
            'display', 'flex-direction', 'justify-content', 'align-items', 'gap',
            'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
            'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'opacity', 'border-radius', 'background-color', 'background',
            'border', 'border-width', 'border-color', 'border-style', 'box-shadow',
            'font-family', 'font-size', 'font-weight', 'line-height', 'color',
            'text-align', 'letter-spacing'
        ];

        const styles = {};
        for (const prop of props) {
            styles[prop] = computed.getPropertyValue(prop);
        }
        return styles;
    }

    function isTextEditable(element) {
        return getTextEditReason(element) === null;
    }

    function createHoveredElement(element) {
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
                height: rect.height
            }
        };
    }

    function createSelectedElement(element) {
        const hovered = createHoveredElement(element);
        const editReason = getTextEditReason(element);
        const editable = editReason === null;

        return {
            ...hovered,
            textContent: editable ? element.textContent : null,
            isTextEditable: editable,
            textEditReason: editReason,
            computedStyles: getComputedStylesSubset(element),
            sourcePath: element.getAttribute('data-source-path') || undefined,
            componentId: element.getAttribute('data-component-id') || undefined,
            propName: element.getAttribute('data-prop-name') || undefined
        };
    }

    // ============================================================================
    // Component Tree Building
    // ============================================================================

    function buildElementNode(element, depth, maxDepth) {
        if (!element || depth > maxDepth) return null;

        // Skip inspector overlays and non-visual elements
        if (element.hasAttribute && (
            element.hasAttribute('data-inspector-overlay') ||
            element.hasAttribute('data-inspector-label')
        )) return null;

        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'HEAD'].includes(element.tagName)) {
            return null;
        }

        const children = [];
        if (depth < maxDepth && element.children) {
            for (const child of Array.from(element.children)) {
                const node = buildElementNode(child, depth + 1, maxDepth);
                if (node) children.push(node);
            }
        }

        nodeIdCounter++;
        return {
            id: 'node-' + nodeIdCounter,
            selector: getUniqueSelector(element),
            tagName: element.tagName.toLowerCase(),
            classList: Array.from(element.classList || []),
            elementId: element.id || '',
            children,
            depth
        };
    }

    function buildComponentTree() {
        nodeIdCounter = 0;
        console.log('[Inspector] Building component tree from body...');
        const rootNode = buildElementNode(document.body, 0, 8);
        const tree = rootNode ? [rootNode] : [];
        console.log('[Inspector] Tree built:', tree.length, 'root nodes');
        return tree;
    }

    // ============================================================================
    // Mutation Tracking
    // ============================================================================

    /**
     * Initialize mutation tracking to detect dynamic text changes
     */
    function initMutationTracking() {
        mutationObserver = new MutationObserver((mutations) => {
            const now = Date.now();

            for (const mutation of mutations) {
                if (mutation.type === 'characterData' || mutation.type === 'childList') {
                    const target = mutation.target.nodeType === Node.TEXT_NODE
                        ? mutation.target.parentElement
                        : mutation.target;

                    if (!target) continue;

                    // Clean up history if it gets too large
                    if (textMutationHistory.size > MAX_HISTORY_SIZE) {
                        // Remove oldest entries
                        const entries = Array.from(textMutationHistory.entries());
                        entries.sort((a, b) => a[1].lastChange - b[1].lastChange);
                        for (let i = 0; i < 100; i++) {
                            textMutationHistory.delete(entries[i][0]);
                        }
                    }

                    const currentText = target.textContent;
                    const history = textMutationHistory.get(target);

                    if (!history) {
                        textMutationHistory.set(target, {
                            text: currentText,
                            changeCount: 1,
                            lastChange: now
                        });
                    } else {
                        // Check if within time window
                        if (now - history.lastChange < MUTATION_WINDOW) {
                            history.changeCount++;
                            history.lastChange = now;
                            history.text = currentText;

                            // Mark as dynamic if threshold exceeded
                            if (history.changeCount >= MUTATION_THRESHOLD) {
                                dynamicTextElements.add(target);
                                console.log('[Inspector] Marked element as dynamic:', target);
                            }
                        } else {
                            // Reset counter if outside window
                            history.changeCount = 1;
                            history.lastChange = now;
                            history.text = currentText;
                        }
                    }
                }
            }
        });

        // Observe entire document
        mutationObserver.observe(document.body, {
            characterData: true,
            childList: true,
            subtree: true
        });

        console.log('[Inspector] Mutation tracking initialized');
    }

    /**
     * Clean up mutation observer
     */
    function cleanupMutationTracking() {
        if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
        }
        textMutationHistory.clear();
        console.log('[Inspector] Mutation tracking cleaned up');
    }

    // ============================================================================
    // Message Handling
    // ============================================================================

    function sendToParent(message) {
        console.log('[Inspector] Sending to parent:', message.type);
        window.parent.postMessage({ ...message, __source: MESSAGE_PREFIX }, '*');
    }

    function handleParentMessage(data) {
        console.log('[Inspector] Received from parent:', data.type);

        switch (data.type) {
            case 'inspector:enable':
                isEnabled = true;
                document.body.style.cursor = 'crosshair';
                console.log('[Inspector] Inspector mode enabled');
                const tree = buildComponentTree();
                sendToParent({ type: 'tree:update', payload: tree });
                break;

            case 'inspector:disable':
                isEnabled = false;
                document.body.style.cursor = '';
                hideHoverOverlay();
                hideSelectionOverlay();
                selectedElement = null;
                console.log('[Inspector] Inspector mode disabled');
                break;

            case 'style:apply':
                const el = document.querySelector(data.payload.selector);
                if (!el) {
                    console.error('[Inspector] Element not found for selector:', data.payload.selector);
                    break;
                }

                const value = data.payload.unit
                    ? data.payload.value + data.payload.unit
                    : data.payload.value;

                console.log('[Inspector] Applying style:', {
                    selector: data.payload.selector,
                    property: data.payload.property,
                    value: value
                });

                el.style.setProperty(data.payload.property, value);
                updateOverlays();
                sendToParent({ type: 'style:changed', payload: data.payload });
                break;

            case 'style:apply-batch':
                for (const change of data.payload) {
                    const elem = document.querySelector(change.selector);
                    if (elem) {
                        const val = change.unit ? change.value + change.unit : change.value;
                        elem.style.setProperty(change.property, val);
                    }
                }
                updateOverlays();
                break;

            case 'text:apply':
                const textEl = document.querySelector(data.payload.selector);
                if (textEl) {
                    textEl.textContent = data.payload.text;
                    sendToParent({ type: 'text:changed', payload: data.payload });
                }
                break;

            case 'tree:request':
                const requestedTree = buildComponentTree();
                sendToParent({ type: 'tree:update', payload: requestedTree });
                break;

            case 'element:highlight':
                if (data.payload) {
                    const highlightEl = document.querySelector(data.payload.selector);
                    if (highlightEl) {
                        showSelectionOverlay(highlightEl);
                        selectedElement = highlightEl;
                        // Send full element data back to parent (same as click selection)
                        const elementData = createSelectedElement(highlightEl);
                        sendToParent({ type: 'element:select', payload: elementData });
                        console.log('[Inspector] Element selected from tree:', data.payload.selector);
                    } else {
                        console.error('[Inspector] Element not found for selector:', data.payload.selector);
                    }
                } else {
                    hideSelectionOverlay();
                    selectedElement = null;
                    sendToParent({ type: 'element:deselect', payload: null });
                }
                break;
        }
    }

    // ============================================================================
    // Event Handlers
    // ============================================================================

    function handleMouseMove(e) {
        if (!isEnabled) return;

        const target = e.target;
        if (!target || target === document.body || target === document.documentElement) {
            hideHoverOverlay();
            sendToParent({ type: 'element:hover', payload: null });
            return;
        }

        if (target.hasAttribute('data-inspector-overlay') ||
            target.hasAttribute('data-inspector-label')) {
            return;
        }

        if (target === selectedElement) {
            hideHoverOverlay();
            return;
        }

        showHoverOverlay(target);
        sendToParent({ type: 'element:hover', payload: createHoveredElement(target) });
    }

    function handleClick(e) {
        if (!isEnabled) return;

        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        if (!target ||
            target.hasAttribute('data-inspector-overlay') ||
            target.hasAttribute('data-inspector-label')) {
            return;
        }

        selectedElement = target;
        hideHoverOverlay();
        showSelectionOverlay(target);

        console.log('[Inspector] Element selected:', target);
        sendToParent({ type: 'element:select', payload: createSelectedElement(target) });
    }

    // ============================================================================
    // Initialization
    // ============================================================================

    function init() {
        console.log('[Inspector] Setting up event listeners...');

        // Event listeners
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('click', handleClick, true);
        window.addEventListener('scroll', updateOverlays, true);
        window.addEventListener('resize', updateOverlays);

        // Message listener
        window.addEventListener('message', function (event) {
            if (!event.data || typeof event.data !== 'object') return;
            if (event.data.__source !== MESSAGE_PREFIX) return;
            handleParentMessage(event.data);
        });

        // Initialize mutation tracking for dynamic text detection
        initMutationTracking();

        console.log('[Inspector] Notifying parent that bridge is ready...');
        sendToParent({ type: 'inspector:ready' });
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
