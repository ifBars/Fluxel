import { useState, useEffect, type ReactNode } from "react";
import { z } from "zod";
import {
    X, Moon, Sun, Check, Code, Monitor, Columns,
    Palette, Layout, Keyboard,
    Type, Eye, Indent, WrapText, Save,
    Maximize2, Sidebar as SidebarIcon, Sparkles, ExternalLink, Hammer, GitBranch
} from "lucide-react";
import { useSettingsStore, type SettingsState, type Theme, type AccentColor, type UIDensity, useWorkbenchStore, type WorkbenchState, type EditorMode } from "@/stores";
import { RECOMMENDED_MODELS } from "../../lib/ollama";

type SettingsSection = 'appearance' | 'editor' | 'autocomplete' | 'workbench' | 'build' | 'versionControl' | 'shortcuts';

const settingsSchema = z.object({
    fontSize: z.number().min(10).max(32),
    tabSize: z.number().min(1).max(8),
    autosaveDelay: z.number().min(0).max(10000),
    sidebarDefaultSize: z.number().min(10).max(50),
    showMinimap: z.boolean(),
    theme: z.enum(["light", "dark"]),
    defaultEditorMode: z.enum(["code", "visual", "split"]),
});

// Keyboard shortcuts mapping (read-only)
const keyboardShortcuts = [
    { command: 'Toggle Sidebar', keys: 'Ctrl/Cmd + B' },
    { command: 'Focus Explorer', keys: 'Ctrl/Cmd + Shift + E' },
    { command: 'Focus Search', keys: 'Ctrl/Cmd + Shift + F' },
    { command: 'Focus Source Control', keys: 'Ctrl/Cmd + Shift + G' },
];

export default function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const settings = useSettingsStore();
    const workbench = useWorkbenchStore();
    const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
    const [fontSize, setFontSize] = useState(settings.fontSize);
    const [tabSize, setTabSize] = useState(settings.tabSize);
    const [autosaveDelay, setAutosaveDelay] = useState(settings.autosaveDelay);
    const [sidebarSize, setSidebarSize] = useState(workbench.sidebarDefaultSize);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Sync internal state when store changes or dialog opens
    useEffect(() => {
        if (isOpen) {
            setFontSize(settings.fontSize);
            setTabSize(settings.tabSize);
            setAutosaveDelay(settings.autosaveDelay);
            setSidebarSize(workbench.sidebarDefaultSize);
            setErrors({});
        }
    }, [settings.fontSize, settings.tabSize, settings.autosaveDelay, workbench.sidebarDefaultSize, isOpen]);

    if (!isOpen) return null;

    const handleFontSizeChange = (val: number) => {
        const parsed = settingsSchema.pick({ fontSize: true }).safeParse({ fontSize: val });
        if (parsed.success) {
            settings.setFontSize(val);
            setFontSize(val);
            setErrors(prev => ({ ...prev, fontSize: '' }));
        } else {
            setErrors(prev => ({ ...prev, fontSize: 'Font size must be between 10 and 32' }));
        }
    };

    const handleTabSizeChange = (val: number) => {
        const parsed = settingsSchema.pick({ tabSize: true }).safeParse({ tabSize: val });
        if (parsed.success) {
            settings.setTabSize(val);
            setTabSize(val);
            setErrors(prev => ({ ...prev, tabSize: '' }));
        } else {
            setErrors(prev => ({ ...prev, tabSize: 'Tab size must be between 1 and 8' }));
        }
    };

    const handleAutosaveDelayChange = (val: number) => {
        const parsed = settingsSchema.pick({ autosaveDelay: true }).safeParse({ autosaveDelay: val });
        if (parsed.success) {
            settings.setAutosaveDelay(val);
            setAutosaveDelay(val);
            setErrors(prev => ({ ...prev, autosaveDelay: '' }));
        } else {
            setErrors(prev => ({ ...prev, autosaveDelay: 'Autosave delay must be between 0 and 10000ms' }));
        }
    };

    const handleSidebarSizeChange = (val: number) => {
        const parsed = settingsSchema.pick({ sidebarDefaultSize: true }).safeParse({ sidebarDefaultSize: val });
        if (parsed.success) {
            workbench.setSidebarDefaultSize(val);
            setSidebarSize(val);
            setErrors(prev => ({ ...prev, sidebarSize: '' }));
        } else {
            setErrors(prev => ({ ...prev, sidebarSize: 'Sidebar size must be between 10% and 50%' }));
        }
    };

    const sections: { id: SettingsSection; label: string; icon: ReactNode }[] = [
        { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
        { id: 'editor', label: 'Editor', icon: <Code size={16} /> },
        { id: 'autocomplete', label: 'Autocomplete', icon: <Sparkles size={16} /> },
        { id: 'workbench', label: 'Workbench', icon: <Layout size={16} /> },
        { id: 'build', label: 'Build', icon: <Hammer size={16} /> },
        { id: 'versionControl', label: 'Version Control', icon: <GitBranch size={16} /> },
        { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={16} /> },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card text-card-foreground w-full max-w-4xl h-[80vh] max-h-[700px] rounded-xl border border-border shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-semibold">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Navigation */}
                    <div className="w-48 border-r border-border bg-muted/20 p-4 overflow-y-auto">
                        <nav className="space-y-1">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === section.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                        }`}
                                >
                                    {section.icon}
                                    {section.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeSection === 'appearance' && <AppearanceSection settings={settings} />}
                        {activeSection === 'editor' && (
                            <EditorSection
                                settings={settings}
                                fontSize={fontSize}
                                tabSize={tabSize}
                                autosaveDelay={autosaveDelay}
                                errors={errors}
                                onFontSizeChange={handleFontSizeChange}
                                onTabSizeChange={handleTabSizeChange}
                                onAutosaveDelayChange={handleAutosaveDelayChange}
                            />
                        )}
                        {activeSection === 'autocomplete' && <AutocompleteSection settings={settings} />}
                        {activeSection === 'workbench' && (
                            <WorkbenchSection
                                settings={settings}
                                workbench={workbench}
                                sidebarSize={sidebarSize}
                                errors={errors}
                                onSidebarSizeChange={handleSidebarSizeChange}
                            />
                        )}
                        {activeSection === 'build' && <BuildSection settings={settings} />}
                        {activeSection === 'versionControl' && <VersionControlSection settings={settings} />}
                        {activeSection === 'shortcuts' && <ShortcutsSection />}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Appearance Section
function AppearanceSection({ settings }: { settings: SettingsState }) {
    const accentColors: { value: AccentColor; label: string; color: string }[] = [
        { value: 'orange', label: 'Orange', color: 'bg-[#f97316]' },
        { value: 'blue', label: 'Blue', color: 'bg-[#3b82f6]' },
        { value: 'green', label: 'Green', color: 'bg-[#22c55e]' },
        { value: 'purple', label: 'Purple', color: 'bg-[#a855f7]' },
        { value: 'red', label: 'Red', color: 'bg-[#ef4444]' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">Appearance</h3>
                <p className="text-sm text-muted-foreground">Customize the look and feel of Fluxel</p>
            </div>

            {/* Theme */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Theme</label>
                <div className="grid grid-cols-2 gap-2">
                    <ThemeOption
                        value="light"
                        current={settings.theme}
                        onClick={() => settings.setTheme("light")}
                        icon={<Sun size={16} />}
                        label="Light"
                    />
                    <ThemeOption
                        value="dark"
                        current={settings.theme}
                        onClick={() => settings.setTheme("dark")}
                        icon={<Moon size={16} />}
                        label="Dark"
                    />
                </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Accent Color</label>
                <div className="grid grid-cols-5 gap-2">
                    {accentColors.map((color) => (
                        <button
                            key={color.value}
                            onClick={() => settings.setAccentColor(color.value)}
                            className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all ${settings.accentColor === color.value
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-border hover:bg-muted/50"
                                }`}
                        >
                            <div className={`w-6 h-6 rounded-full ${color.color}`} />
                            <span className="text-xs font-medium">{color.label}</span>
                            {settings.accentColor === color.value && (
                                <Check size={12} className="absolute top-1 right-1 text-primary" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Icon Pack */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Icon Pack</label>
                <div className="grid grid-cols-2 gap-2">
                    <IconPackOption
                        value="react-icons"
                        current={settings.iconPack}
                        onClick={() => settings.setIconPack("react-icons")}
                        label="React Icons"
                    />
                    <IconPackOption
                        value="lucide"
                        current={settings.iconPack}
                        onClick={() => settings.setIconPack("lucide")}
                        label="Lucide"
                    />
                    <IconPackOption
                        value="react-file-icon"
                        current={settings.iconPack}
                        onClick={() => settings.setIconPack("react-file-icon")}
                        label="React File Icon"
                    />
                    <IconPackOption
                        value="material"
                        current={settings.iconPack}
                        onClick={() => settings.setIconPack("material")}
                        label="Material"
                    />
                    <IconPackOption
                        value="exuanbo"
                        current={settings.iconPack}
                        onClick={() => settings.setIconPack("exuanbo")}
                        label="Exuanbo (JS)"
                    />
                </div>
            </div>

            {/* UI Density */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">UI Density</label>
                <div className="grid grid-cols-3 gap-2">
                    <DensityOption
                        value="compact"
                        current={settings.uiDensity}
                        onClick={() => settings.setUIDensity("compact")}
                        label="Compact"
                        description="Editor-focused, minimal chrome"
                    />
                    <DensityOption
                        value="comfortable"
                        current={settings.uiDensity}
                        onClick={() => settings.setUIDensity("comfortable")}
                        label="Comfortable"
                        description="Balanced layout"
                    />
                    <DensityOption
                        value="spacious"
                        current={settings.uiDensity}
                        onClick={() => settings.setUIDensity("spacious")}
                        label="Spacious"
                        description="More room for all panels"
                    />
                </div>
            </div>
        </div>
    );
}

// Editor Section
function EditorSection({
    settings,
    fontSize,
    tabSize,
    autosaveDelay,
    errors,
    onFontSizeChange,
    onTabSizeChange,
    onAutosaveDelayChange,
}: {
    settings: SettingsState;
    fontSize: number;
    tabSize: number;
    autosaveDelay: number;
    errors: Record<string, string>;
    onFontSizeChange: (val: number) => void;
    onTabSizeChange: (val: number) => void;
    onAutosaveDelayChange: (val: number) => void;
}) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">Editor</h3>
                <p className="text-sm text-muted-foreground">Configure editor behavior and appearance</p>
            </div>

            {/* Font Size */}
            <div className="space-y-3">
                <div className="flex justify-between">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Type size={16} />
                        Editor Font Size
                    </label>
                    <span className="text-sm font-mono">{fontSize}px</span>
                </div>
                <input
                    type="range"
                    min={10}
                    max={32}
                    value={fontSize}
                    onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                {errors.fontSize && <p className="text-xs text-destructive">{errors.fontSize}</p>}
            </div>

            {/* Show Line Numbers */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Eye size={16} />
                    Show Line Numbers
                </label>
                <button
                    onClick={() => settings.setShowLineNumbers(!settings.showLineNumbers)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${settings.showLineNumbers ? "bg-primary" : "bg-muted"
                        }`}
                >
                    <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.showLineNumbers ? "translate-x-5" : "translate-x-0"
                            }`}
                    />
                </button>
            </div>

            {/* Tab Size */}
            <div className="space-y-3">
                <div className="flex justify-between">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Indent size={16} />
                        Tab Size
                    </label>
                    <span className="text-sm font-mono">{tabSize} spaces</span>
                </div>
                <input
                    type="range"
                    min={1}
                    max={8}
                    value={tabSize}
                    onChange={(e) => onTabSizeChange(parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                {errors.tabSize && <p className="text-xs text-destructive">{errors.tabSize}</p>}
            </div>

            {/* Word Wrap */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <WrapText size={16} />
                    Word Wrap
                </label>
                <button
                    onClick={() => settings.setWordWrap(!settings.wordWrap)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${settings.wordWrap ? "bg-primary" : "bg-muted"
                        }`}
                >
                    <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.wordWrap ? "translate-x-5" : "translate-x-0"
                            }`}
                    />
                </button>
            </div>

            {/* Show Minimap */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Eye size={16} />
                    Show Minimap
                </label>
                <button
                    onClick={() => settings.setShowMinimap(!settings.showMinimap)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${settings.showMinimap ? "bg-primary" : "bg-muted"
                        }`}
                >
                    <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.showMinimap ? "translate-x-5" : "translate-x-0"
                            }`}
                    />
                </button>
            </div>

            {/* Autosave Delay */}
            <div className="space-y-3">
                <div className="flex justify-between">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Save size={16} />
                        Autosave Delay
                    </label>
                    <span className="text-sm font-mono">{autosaveDelay}ms</span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={10000}
                    step={100}
                    value={autosaveDelay}
                    onChange={(e) => onAutosaveDelayChange(parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                    {autosaveDelay === 0 ? 'Autosave disabled' : `Files save automatically after ${autosaveDelay}ms of inactivity`}
                </p>
                {errors.autosaveDelay && <p className="text-xs text-destructive">{errors.autosaveDelay}</p>}
            </div>
        </div>
    );
}

// Autocomplete Section
function AutocompleteSection({ settings }: { settings: SettingsState }) {
    const [customModel, setCustomModel] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    const handleModelChange = (modelId: string) => {
        if (modelId === 'custom') {
            setShowCustomInput(true);
        } else {
            setShowCustomInput(false);
            settings.setAutocompleteModel(modelId);
        }
    };

    const handleCustomModelSubmit = () => {
        if (customModel.trim()) {
            settings.setAutocompleteModel(customModel.trim());
            setShowCustomInput(false);
        }
    };

    const isCustomModel = !RECOMMENDED_MODELS.some(m => m.id === settings.autocompleteModel);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">AI Autocomplete</h3>
                <p className="text-sm text-muted-foreground">Configure AI-powered code suggestions using Ollama</p>
            </div>

            {/* Enable Autocomplete */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Sparkles size={16} />
                        Enable AI Autocomplete
                    </label>
                    <span className="text-xs text-muted-foreground">Show inline suggestions as you type</span>
                </div>
                <button
                    onClick={() => settings.setAutocompleteEnabled(!settings.autocompleteEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${settings.autocompleteEnabled ? "bg-primary" : "bg-muted"
                        }`}
                >
                    <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.autocompleteEnabled ? "translate-x-5" : "translate-x-0"
                            }`}
                    />
                </button>
            </div>

            {/* Model Selection */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Model</label>
                <div className="space-y-2">
                    {RECOMMENDED_MODELS.map((model) => (
                        <button
                            key={model.id}
                            onClick={() => handleModelChange(model.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${settings.autocompleteModel === model.id && !showCustomInput
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-border hover:bg-muted/50"
                                }`}
                        >
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">{model.name}</span>
                                <span className="text-xs text-muted-foreground">{model.description}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">{model.vram}</span>
                                {settings.autocompleteModel === model.id && !showCustomInput && (
                                    <Check size={14} className="text-primary" />
                                )}
                            </div>
                        </button>
                    ))}

                    {/* Custom Model Option */}
                    <button
                        onClick={() => handleModelChange('custom')}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${(showCustomInput || isCustomModel)
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "border-border hover:bg-muted/50"
                            }`}
                    >
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">Custom Model</span>
                            <span className="text-xs text-muted-foreground">
                                {isCustomModel && !showCustomInput ? settings.autocompleteModel : 'Enter a custom Ollama model name'}
                            </span>
                        </div>
                        {(showCustomInput || isCustomModel) && (
                            <Check size={14} className="text-primary" />
                        )}
                    </button>

                    {showCustomInput && (
                        <div className="flex gap-2 mt-2">
                            <input
                                type="text"
                                value={customModel}
                                onChange={(e) => setCustomModel(e.target.value)}
                                placeholder="e.g., llama3.2:3b"
                                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                onKeyDown={(e) => e.key === 'Enter' && handleCustomModelSubmit()}
                            />
                            <button
                                onClick={handleCustomModelSubmit}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Ollama Endpoint */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Ollama Endpoint</label>
                <input
                    type="text"
                    value={settings.autocompleteEndpoint}
                    onChange={(e) => settings.setAutocompleteEndpoint(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-xs text-muted-foreground">Default: http://localhost:11434</p>
            </div>

            {/* Debounce Delay */}
            <div className="space-y-3">
                <div className="flex justify-between">
                    <label className="text-sm font-medium text-foreground">Suggestion Delay</label>
                    <span className="text-sm font-mono">{settings.autocompleteDebounceMs}ms</span>
                </div>
                <input
                    type="range"
                    min={100}
                    max={1000}
                    step={50}
                    value={settings.autocompleteDebounceMs}
                    onChange={(e) => settings.setAutocompleteDebounceMs(parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                    Wait time before requesting suggestions. Lower = faster, but more API calls.
                </p>
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-start gap-3">
                    <Sparkles size={20} className="text-primary shrink-0 mt-0.5" />
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Requires Ollama</p>
                        <p className="text-xs text-muted-foreground">
                            Autocomplete uses Ollama to run AI models locally on your machine.
                            Make sure Ollama is installed and the selected model is pulled.
                        </p>
                        <a
                            href="https://ollama.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                            Install Ollama <ExternalLink size={12} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Workbench Section
function WorkbenchSection({
    settings,
    workbench,
    sidebarSize,
    errors,
    onSidebarSizeChange,
}: {
    settings: SettingsState;
    workbench: WorkbenchState;
    sidebarSize: number;
    errors: Record<string, string>;
    onSidebarSizeChange: (val: number) => void;
}) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">Workbench</h3>
                <p className="text-sm text-muted-foreground">Configure workbench layout and behavior</p>
            </div>

            {/* Default Editor Mode */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Default Editor Mode</label>
                <div className="grid grid-cols-3 gap-2">
                    <EditorModeOption
                        value="code"
                        current={settings.defaultEditorMode}
                        onClick={() => settings.setDefaultEditorMode("code")}
                        icon={<Code size={16} />}
                        label="Code"
                    />
                    <EditorModeOption
                        value="split"
                        current={settings.defaultEditorMode}
                        onClick={() => settings.setDefaultEditorMode("split")}
                        icon={<Columns size={16} />}
                        label="Split"
                    />
                    <EditorModeOption
                        value="visual"
                        current={settings.defaultEditorMode}
                        onClick={() => settings.setDefaultEditorMode("visual")}
                        icon={<Monitor size={16} />}
                        label="Visual"
                    />
                </div>
            </div>

            {/* Default Sidebar Open */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <SidebarIcon size={16} />
                    Sidebar Open by Default
                </label>
                <button
                    onClick={() => workbench.setDefaultSidebarOpen(!workbench.defaultSidebarOpen)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${workbench.defaultSidebarOpen ? "bg-primary" : "bg-muted"
                        }`}
                >
                    <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${workbench.defaultSidebarOpen ? "translate-x-5" : "translate-x-0"
                            }`}
                    />
                </button>
            </div>

            {/* Sidebar Default Size */}
            <div className="space-y-3">
                <div className="flex justify-between">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Maximize2 size={16} />
                        Sidebar Default Size
                    </label>
                    <span className="text-sm font-mono">{sidebarSize}%</span>
                </div>
                <input
                    type="range"
                    min={10}
                    max={50}
                    value={sidebarSize}
                    onChange={(e) => onSidebarSizeChange(parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                {errors.sidebarSize && <p className="text-xs text-destructive">{errors.sidebarSize}</p>}
            </div>

            {/* Enable Panel Snap */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Maximize2 size={16} />
                    Enable Panel Snap
                </label>
                <button
                    onClick={() => workbench.setEnablePanelSnap(!workbench.enablePanelSnap)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${workbench.enablePanelSnap ? "bg-primary" : "bg-muted"
                        }`}
                >
                    <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${workbench.enablePanelSnap ? "translate-x-5" : "translate-x-0"
                            }`}
                    />
                </button>
            </div>
        </div>
    );
}

// Shortcuts Section
function ShortcutsSection() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">Keyboard Shortcuts</h3>
                <p className="text-sm text-muted-foreground">View available keyboard shortcuts</p>
            </div>

            <div className="space-y-2">
                {keyboardShortcuts.map((shortcut, index) => (
                    <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20"
                    >
                        <span className="text-sm font-medium text-foreground">{shortcut.command}</span>
                        <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded">
                            {shortcut.keys}
                        </kbd>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Build Section
function BuildSection({ settings }: { settings: SettingsState }) {
    const buildSystems: { value: import("@/stores").BuildSystem; label: string; description: string }[] = [
        { value: 'auto', label: 'Auto-Detect', description: 'Automatically detect project type' },
        { value: 'dotnet', label: '.NET', description: 'Build with dotnet build' },
        { value: 'bun', label: 'Bun', description: 'Build with bun run build' },
        { value: 'npm', label: 'NPM', description: 'Build with npm run build' },
        { value: 'manual', label: 'Custom', description: 'Use a custom build command' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">Build</h3>
                <p className="text-sm text-muted-foreground">Configure build system and commands</p>
            </div>

            {/* Build System */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Build System</label>
                <div className="space-y-2">
                    {buildSystems.map((system) => (
                        <button
                            key={system.value}
                            onClick={() => settings.setBuildSystem(system.value)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${settings.buildSystem === system.value
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-border hover:bg-muted/50"
                                }`}
                        >
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">{system.label}</span>
                                <span className="text-xs text-muted-foreground">{system.description}</span>
                            </div>
                            {settings.buildSystem === system.value && (
                                <Check size={14} className="text-primary" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Build Command */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Custom Build Command</label>
                <input
                    type="text"
                    value={settings.customBuildCommand}
                    onChange={(e) => settings.setCustomBuildCommand(e.target.value)}
                    placeholder="e.g. npm run build:prod"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    disabled={settings.buildSystem !== 'manual'}
                />
            </div>
        </div>
    );
}

// Version Control Section
function VersionControlSection({ settings }: { settings: SettingsState }) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">Version Control</h3>
                <p className="text-sm text-muted-foreground">Configure Git and GitHub integration</p>
            </div>

            {/* GitHub Token */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">GitHub Personal Access Token</label>
                <input
                    type="password"
                    value={settings.githubToken}
                    onChange={(e) => settings.setGithubToken(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-xs text-muted-foreground">
                    Required for push/pull operations. Create one at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub Settings</a>.
                    Scopes needed: <code>repo</code>
                </p>
            </div>
        </div>
    );
}


// Shortcuts Section
function ThemeOption({
    value,
    current,
    onClick,
    icon,
    label,
}: {
    value: Theme;
    current: Theme;
    onClick: () => void;
    icon: ReactNode;
    label: string;
}) {
    const isActive = value === current;
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${isActive
                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
        >
            {icon}
            <span className="text-sm font-medium">{label}</span>
            {isActive && <Check size={14} className="ml-auto" />}
        </button>
    );
}

function DensityOption({
    value,
    current,
    onClick,
    label,
    description,
}: {
    value: UIDensity;
    current: UIDensity;
    onClick: () => void;
    label: string;
    description: string;
}) {
    const isActive = value === current;
    return (
        <button
            onClick={onClick}
            className={`relative flex flex-col items-start gap-1 p-3 rounded-lg border transition-all text-left ${isActive
                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
        >
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs opacity-70">{description}</span>
            {isActive && <Check size={14} className="absolute top-1 right-1" />}
        </button>
    );
}

function EditorModeOption({
    value,
    current,
    onClick,
    icon,
    label,
}: {
    value: EditorMode;
    current: EditorMode;
    onClick: () => void;
    icon: ReactNode;
    label: string;
}) {
    const isActive = value === current;
    return (
        <button
            onClick={onClick}
            className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border transition-all ${isActive
                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
        >
            {icon}
            <span className="text-xs font-medium">{label}</span>
            {isActive && <Check size={12} className="absolute top-1 right-1" />}
        </button>
    );
}

function IconPackOption({
    value,
    current,
    onClick,
    label,
}: {
    value: string;
    current: string;
    onClick: () => void;
    label: string;
}) {
    const isActive = value === current;
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${isActive
                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
        >
            <span className="text-sm font-medium">{label}</span>
            {isActive && <Check size={14} />}
        </button>
    );
}
