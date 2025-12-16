import React, { useMemo, useState } from 'react';
import { useProfilerStore } from '@/stores/profiler';
import type { SpanTreeNode } from '@/types/profiling';
import ScrollableArea from '@/components/ui/scrollable-area';
import { Flame, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FlameRectProps {
  node: SpanTreeNode;
  x: number;
  width: number;
  y: number;
  totalDuration: number;
  onSelect: (node: SpanTreeNode) => void;
  selectedId: string | null;
  zoom: number;
}

const FlameRect: React.FC<FlameRectProps> = ({
  node,
  x,
  width,
  y,
  totalDuration,
  onSelect,
  selectedId,
  zoom,
}) => {
  const ROW_HEIGHT = 24;
  const MIN_WIDTH_TO_SHOW = 0.5; // Don't render if too narrow

  if (width < MIN_WIDTH_TO_SHOW) {
    return null;
  }

  const { span, children, selfTimeMs } = node;
  const isSelected = selectedId === span.id;
  
  // Calculate color based on category and self-time ratio
  const selfRatio = span.durationMs > 0 ? selfTimeMs / span.durationMs : 0;
  
  const getCategoryColor = (category: string, selfRatio: number) => {
    // Base colors by category
    let hue = 200; // default blue
    switch (category) {
      case 'frontend_render': hue = 220; break; // blue
      case 'frontend_interaction': hue = 280; break; // purple
      case 'frontend_network': hue = 140; break; // green
      case 'tauri_command': hue = 30; break; // orange
      case 'backend_operation': hue = 180; break; // cyan
      case 'file_io': hue = 50; break; // yellow
      case 'git_operation': hue = 320; break; // magenta
      case 'lsp_request': hue = 260; break; // violet
      default: hue = 0; break; // red/gray
    }
    
    // Increase saturation for higher self-time (hotspots)
    const saturation = 50 + (selfRatio * 40); // 50-90%
    const lightness = 55 + (10 - selfRatio * 15); // 55-70% (darker = more self-time)
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const bgColor = getCategoryColor(span.category, selfRatio);
  const textColor = selfRatio > 0.5 ? '#fff' : '#000';
  
  // Calculate text to display
  const showText = width > 50;
  const showFullText = width > 150;
  let displayText = '';
  if (showFullText) {
    displayText = `${span.name} (${span.durationMs.toFixed(2)}ms)`;
  } else if (showText) {
    displayText = span.name.length > 20 ? `${span.name.substring(0, 17)}...` : span.name;
  }

  // Render children
  let childX = x;
  const childRects = children.map((child) => {
    const childWidth = (child.span.durationMs / span.durationMs) * width;
    const rect = (
      <FlameRect
        key={child.span.id}
        node={child}
        x={childX}
        width={childWidth}
        y={y + ROW_HEIGHT}
        totalDuration={totalDuration}
        onSelect={onSelect}
        selectedId={selectedId}
        zoom={zoom}
      />
    );
    childX += childWidth;
    return rect;
  });

  return (
    <>
      <div
        className={`absolute cursor-pointer border border-black/20 transition-all hover:border-black/60 ${
          isSelected ? 'ring-2 ring-primary shadow-lg z-10' : ''
        }`}
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${ROW_HEIGHT - 2}px`,
          backgroundColor: bgColor,
          color: textColor,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
        title={`${span.name}\nTotal: ${span.durationMs.toFixed(2)}ms\nSelf: ${selfTimeMs.toFixed(2)}ms\nCategory: ${span.category}`}
      >
        {showText && (
          <div className="px-1 text-xs font-mono truncate leading-[22px]">
            {displayText}
          </div>
        )}
      </div>
      {childRects}
    </>
  );
};

export const FlameGraphView: React.FC = () => {
  const { recentSpans, selectedSpan, selectSpan } = useProfilerStore();
  const [zoom, setZoom] = useState(1);
  const [focusedRootId, setFocusedRootId] = useState<string | null>(null);

  // Build tree structure from recent spans
  const { trees, rootSpans } = useMemo(() => {
    if (recentSpans.length === 0) {
      return { trees: [], rootSpans: [] };
    }

    // Normalize IDs: ensure all IDs are strings and trimmed
    const normalizeId = (id: string | null | undefined): string | null => {
      if (!id) return null;
      return String(id).trim();
    };

    // Create span map (normalize IDs)
    const spanMap = new Map<string, typeof recentSpans[0]>();
    for (const span of recentSpans) {
      const normalizedId = normalizeId(span.id);
      if (normalizedId) {
        spanMap.set(normalizedId, span);
      }
    }

    // Build children map
    const childrenMap = new Map<string, typeof recentSpans>();
    const roots: typeof recentSpans = [];

    for (const span of recentSpans) {
      const normalizedParentId = normalizeId(span.parentId);
      
      // Check if parent exists in the map (using normalized ID)
      if (normalizedParentId && spanMap.has(normalizedParentId)) {
        const siblings = childrenMap.get(normalizedParentId) || [];
        siblings.push(span);
        childrenMap.set(normalizedParentId, siblings);
      } else {
        // No parent or parent not found - treat as root
        roots.push(span);
      }
    }

    // Calculate self-time
    const selfTimes = new Map<string, number>();
    for (const span of recentSpans) {
      const normalizedId = normalizeId(span.id);
      if (normalizedId) {
        const children = childrenMap.get(normalizedId) || [];
        const childrenTime = children.reduce((sum, c) => sum + c.durationMs, 0);
        selfTimes.set(normalizedId, Math.max(0, span.durationMs - childrenTime));
      }
    }

    // Build tree nodes
    const buildNode = (span: typeof recentSpans[0], depth: number): SpanTreeNode => {
      const normalizedId = normalizeId(span.id);
      const children = (normalizedId ? childrenMap.get(normalizedId) || [] : [])
        .sort((a, b) => a.startTimeMs - b.startTimeMs); // Sort by start time for flame graph
      
      return {
        span,
        selfTimeMs: (normalizedId ? selfTimes.get(normalizedId) : undefined) || 0,
        children: children.map(c => buildNode(c, depth + 1)),
        depth,
      };
    };

    // Filter by focused root if set
    const rootsToUse = focusedRootId
      ? roots.filter(r => r.id === focusedRootId)
      : roots;

    const trees = rootsToUse
      .sort((a, b) => b.durationMs - a.durationMs)
      .map(r => buildNode(r, 0));

    return { trees, rootSpans: roots };
  }, [recentSpans, focusedRootId]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.5, 10));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.5, 0.5));
  const handleResetZoom = () => setZoom(1);

  if (recentSpans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Flame className="w-8 h-8 mb-2 opacity-50" />
        <p>No spans recorded yet.</p>
        <p className="text-xs mt-1">Perform actions to see the flame graph.</p>
      </div>
    );
  }

  if (trees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Flame className="w-8 h-8 mb-2 opacity-50" />
        <p>No matching spans found.</p>
      </div>
    );
  }

  const CANVAS_WIDTH = 1200 * zoom;
  const PADDING = 10;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">Root:</span>
        <select
          className="text-xs bg-background border border-border rounded px-2 py-1 max-w-[200px]"
          value={focusedRootId || ''}
          onChange={(e) => setFocusedRootId(e.target.value || null)}
        >
          <option value="">All roots ({rootSpans.length})</option>
          {rootSpans
            .sort((a, b) => b.durationMs - a.durationMs)
            .slice(0, 20)
            .map((span) => (
              <option key={span.id} value={span.id}>
                {span.name} ({span.durationMs.toFixed(1)}ms)
              </option>
            ))}
        </select>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="h-7 w-7"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {(zoom * 100).toFixed(0)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= 10}
            className="h-7 w-7"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetZoom}
            className="h-7 w-7"
            title="Reset zoom"
          >
            <Maximize2 size={14} />
          </Button>
        </div>
      </div>

      {/* Flame Graph Canvas */}
      <ScrollableArea className="flex-1">
        <div className="p-4">
          <div className="relative" style={{ width: `${CANVAS_WIDTH}px`, minHeight: '400px' }}>
            {trees.map((tree, i) => {
              const yOffset = i * 300; // Stack multiple roots vertically
              return (
                <div key={tree.span.id} className="relative mb-4">
                  <FlameRect
                    node={tree}
                    x={PADDING}
                    width={CANVAS_WIDTH - PADDING * 2}
                    y={yOffset}
                    totalDuration={tree.span.durationMs}
                    onSelect={(node) => selectSpan(node.span)}
                    selectedId={selectedSpan?.id || null}
                    zoom={zoom}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </ScrollableArea>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground bg-muted/30">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            <Flame size={10} className="text-orange-500" />
            <span>Darker colors = higher self-time (hotspots)</span>
          </div>
          <div>Width = total time (including children)</div>
          <div>Y-axis = call depth</div>
          <div>Click to select span</div>
        </div>
      </div>
    </div>
  );
};
