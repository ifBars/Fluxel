import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useEditorStore } from '@/stores';

export default function TabBar() {
    const {
        tabs,
        activeTabId,
        setActiveTab,
        closeTab,
        closeAllTabs,
        closeOtherTabs,
        closeTabsToRight,
        isDirty,
    } = useEditorStore();
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        tabId: string;
    } | null>(null);

    if (tabs.length === 0) {
        return null;
    }

    const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
        if (e.button === 1) {
            e.preventDefault();
            closeTab(tabId);
        }
    };

    const handleTabContextMenu = (
        e: React.MouseEvent,
        tabId: string
    ) => {
        e.preventDefault();
        setActiveTab(tabId);
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            tabId,
        });
    };

    const handleMenuAction = (action: 'close' | 'closeOthers' | 'closeRight' | 'closeAll') => {
        if (!contextMenu) return;

        switch (action) {
            case 'close':
                closeTab(contextMenu.tabId);
                break;
            case 'closeOthers':
                closeOtherTabs(contextMenu.tabId);
                break;
            case 'closeRight':
                closeTabsToRight(contextMenu.tabId);
                break;
            case 'closeAll':
                closeAllTabs();
                break;
        }

        setContextMenu(null);
    };

    useEffect(() => {
        const handleGlobalClick = () => setContextMenu(null);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setContextMenu(null);
            }
        };

        window.addEventListener('click', handleGlobalClick);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('click', handleGlobalClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <div
            className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            style={{
                gap: 'var(--density-gap-sm, 0.125rem)',
                height: 'var(--tab-bar-height, 2.25rem)',
                fontSize: 'var(--tab-bar-font-size, 0.8125rem)',
            }}
        >
            {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const dirty = isDirty(tab.id);

                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        onMouseDown={(e) => handleMiddleClick(e, tab.id)}
                        onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                        title={tab.path}
                        className={`
              group flex items-center text-xs font-medium
              border-b-2 transition-all shrink-0
              ${isActive
                                ? 'bg-background text-foreground border-primary'
                                : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted/30 hover:text-foreground'
                            }
            `}
                        style={{
                            gap: 'var(--density-gap-md, 0.75rem)',
                            paddingLeft: 'var(--density-padding-md, 0.75rem)',
                            paddingRight: 'var(--density-padding-md, 0.75rem)',
                            paddingTop: 'var(--density-padding-sm, 0.5rem)',
                            paddingBottom: 'var(--density-padding-sm, 0.5rem)',
                        }}
                    >
                        {/* Dirty indicator */}
                        {dirty && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}

                        {/* Filename */}
                        <span className="truncate max-w-[120px]">
                            {tab.filename}
                        </span>

                        {/* Close button */}
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                closeTab(tab.id);
                            }}
                            className={`
                rounded hover:bg-muted transition-colors
                ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
              `}
                            style={{
                                padding: 'var(--density-gap-sm, 0.125rem)',
                            }}
                        >
                            <X className="w-3 h-3" />
                        </span>
                    </button>
                );
            })}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-popover text-popover-foreground border border-border shadow-lg rounded-md min-w-[180px] py-1"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => handleMenuAction('close')}
                    >
                        Close
                    </button>
                    <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => handleMenuAction('closeOthers')}
                    >
                        Close others
                    </button>
                    <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => handleMenuAction('closeRight')}
                    >
                        Close tabs to the right
                    </button>
                    <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => handleMenuAction('closeAll')}
                    >
                        Close all
                    </button>
                </div>
            )}
        </div>
    );
}
