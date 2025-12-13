import React, { useState } from 'react';
import { useProfilerStore } from '@/stores/profiler';
import { ProfilerService } from '@/lib/services/ProfilerService';

export const SessionControls: React.FC = () => {
    const {
        isEnabled,
        toggle,
        activeSession,
        startSession,
        endSession,
        isLoading,
        clear
    } = useProfilerStore();

    const [sessionName, setSessionName] = useState('New Session');

    const handleStartSession = async () => {
        if (!sessionName.trim()) return;
        await startSession(sessionName);
    };

    const handleExport = async (format: 'json' | 'chrome_trace') => {
        try {
            const sessionName = activeSession?.name || undefined;
            const timestamp = Date.now();
            const filename = `fluxel-profile-${sessionName || 'export'}-${timestamp}.${format === 'json' ? 'json' : 'json'}`;
            await ProfilerService.downloadExport(format, filename, sessionName);
        } catch (error) {
            console.error('Failed to export profiling data:', error);
            alert(`Failed to export profiling data: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    return (
        <div className="flex items-center gap-4 p-4 border-b border-border bg-card">
            {/* Global Toggle */}
            <div className="flex items-center gap-2 mr-4 border-r border-border pr-4">
                <span className="text-sm font-medium">Global Profiling</span>
                <button
                    onClick={() => toggle()}
                    disabled={isLoading}
                    className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                        ${isEnabled ? 'bg-primary' : 'bg-muted'}
                    `}
                >
                    <span
                        className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
                        `}
                    />
                </button>
            </div>

            {/* Session Management */}
            <div className="flex items-center gap-2 flex-1">
                {activeSession ? (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-sm font-medium text-red-500">
                                Recording: {activeSession.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                                {((Date.now() - activeSession.startTime) / 1000).toFixed(1)}s
                            </span>
                        </div>
                        <button
                            onClick={() => endSession()}
                            disabled={isLoading}
                            className="px-3 py-1 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 rounded-md transition-colors"
                        >
                            Stop Recording
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={sessionName}
                            onChange={(e) => setSessionName(e.target.value)}
                            placeholder="Session Name"
                            className="bg-background border border-input rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button
                            onClick={handleStartSession}
                            disabled={!isEnabled || isLoading || !sessionName.trim()}
                            className="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Start Recording
                        </button>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => clear()}
                    disabled={isLoading || !!activeSession}
                    className="px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                >
                    Clear
                </button>
                <div className="h-4 w-px bg-border mx-1" />
                <button
                    onClick={() => handleExport('json')}
                    disabled={isLoading}
                    className="px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                >
                    Export JSON
                </button>
                <button
                    onClick={() => handleExport('chrome_trace')}
                    disabled={isLoading}
                    className="px-3 py-1 text-sm font-medium text-accent-foreground bg-accent hover:bg-accent/80 rounded-md transition-colors"
                >
                    Export Chrome Trace
                </button>
            </div>
        </div>
    );
};
