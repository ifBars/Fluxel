import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AuthAuroraBackdrop } from "./AuthAuroraBackdrop";
import { useSettingsStore, type AccentColor } from "@/stores";
import { FrontendProfiler } from "@/lib/services";

// Inline SVG icons to avoid eager loading lucide-react during app initialization
const GithubIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
  </svg>
);

const MoonIcon = ({ className, size }: { className?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const SunIcon = ({ className, size }: { className?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const CheckIcon = ({ className, size }: { className?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const LogOutIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const accentColors: { value: AccentColor; label: string; color: string }[] = [
    { value: 'orange', label: 'Orange', color: 'bg-[#f97316]' },
    { value: 'blue', label: 'Blue', color: 'bg-[#3b82f6]' },
    { value: 'green', label: 'Green', color: 'bg-[#22c55e]' },
    { value: 'purple', label: 'Purple', color: 'bg-[#a855f7]' },
    { value: 'red', label: 'Red', color: 'bg-[#ef4444]' },
];

export default function AuthPage({
    onLogin,
    onSkipLogin,
}: {
    onLogin: () => void;
    onSkipLogin?: () => void;
}) {
    const { theme, setTheme, accentColor, setAccentColor } = useSettingsStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        };

        if (isExpanded) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isExpanded]);

    const currentAccent = accentColors.find(c => c.value === accentColor);
    const handleSkipLogin = onSkipLogin ?? onLogin;

    return (
        <div className="h-full w-full flex">
            {/* Left Panel - Interaction */}
            <div className="w-full lg:w-1/2 bg-background flex flex-col justify-center px-8 lg:px-24 xl:px-32 relative z-10">
                {/* Theme & Accent Picker */}
                <div ref={pickerRef} className="absolute top-6 right-6">
                    {/* Toggle Button */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors duration-200 group border border-transparent hover:border-border"
                        aria-label="Theme settings"
                    >
                        {theme === "dark" ? (
                            <MoonIcon size={20} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                        ) : (
                            <SunIcon size={20} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                        <div className={`w-3 h-3 rounded-full ${currentAccent?.color}`} />
                    </button>

                    {/* Expanded Panel */}
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className="absolute top-full right-0 mt-2 p-3 bg-card border border-border rounded-xl shadow-lg min-w-[200px]"
                            >
                                {/* Theme Section */}
                                <div className="space-y-2 mb-3">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Theme</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => {
                                                FrontendProfiler.trackInteraction('theme_change', { theme: 'light' });
                                                FrontendProfiler.profileSync('auth:set_theme', 'frontend_interaction', () => {
                                                    setTheme("light");
                                                }, { theme: 'light' });
                                            }}
                                            className={`flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${theme === "light"
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border hover:bg-muted/50 text-muted-foreground"
                                                }`}
                                        >
                                            <SunIcon size={14} />
                                            <span className="text-xs font-medium">Light</span>
                                            {theme === "light" && <CheckIcon size={12} />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                FrontendProfiler.trackInteraction('theme_change', { theme: 'dark' });
                                                FrontendProfiler.profileSync('auth:set_theme', 'frontend_interaction', () => {
                                                    setTheme("dark");
                                                }, { theme: 'dark' });
                                            }}
                                            className={`flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${theme === "dark"
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border hover:bg-muted/50 text-muted-foreground"
                                                }`}
                                        >
                                            <MoonIcon size={14} />
                                            <span className="text-xs font-medium">Dark</span>
                                            {theme === "dark" && <CheckIcon size={12} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Accent Color Section */}
                                <div className="space-y-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accent</span>
                                    <div className="flex gap-2">
                                        {accentColors.map((color) => (
                                            <button
                                                key={color.value}
                                                onClick={() => {
                                                    FrontendProfiler.trackInteraction('accent_color_change', { color: color.value });
                                                    FrontendProfiler.profileSync('auth:set_accent_color', 'frontend_interaction', () => {
                                                        setAccentColor(color.value);
                                                    }, { color: color.value });
                                                }}
                                                className={`relative w-7 h-7 rounded-full ${color.color} transition-all hover:scale-110 ${accentColor === color.value ? "ring-2 ring-offset-2 ring-offset-card ring-foreground" : ""
                                                    }`}
                                                aria-label={color.label}
                                            >
                                                {accentColor === color.value && (
                                                    <CheckIcon size={14} className="absolute inset-0 m-auto text-white drop-shadow-md" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="space-y-8"
                >
                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground font-sans">
                            Welcome to <span className="text-primary">Fluxel</span>!
                        </h1>
                        <p className="text-lg text-muted-foreground w-full max-w-md">
                            A next-generation code editor that empowers human creativity with AI intelligence.
                        </p>
                    </div>

                    <div className="space-y-4 w-full max-w-sm">
                        <Button
                            variant="surface"
                            size="tile"
                            className="w-full justify-start"
                            onClick={() => {
                                const clickSpan = FrontendProfiler.startSpan('auth:github_login_click', 'frontend_interaction');
                                FrontendProfiler.trackInteraction('button_click', { button: 'github_login' });
                                FrontendProfiler.profileSync('auth:github_login_handler', 'frontend_interaction', () => {
                                    onLogin();
                                }, { provider: 'github' });
                                clickSpan.end({ provider: 'github' });
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <GithubIcon className="h-5 w-5 text-muted-foreground" />
                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-medium text-foreground">
                                        Continue with GitHub
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Sign in with your GitHub account
                                    </span>
                                </div>
                            </div>
                        </Button>
                        <Button
                            variant="surface"
                            size="tile"
                            className="w-full justify-start"
                            onClick={() => {
                                const clickSpan = FrontendProfiler.startSpan('auth:google_login_click', 'frontend_interaction');
                                FrontendProfiler.trackInteraction('button_click', { button: 'google_login' });
                                FrontendProfiler.profileSync('auth:google_login_handler', 'frontend_interaction', () => {
                                    onLogin();
                                }, { provider: 'google' });
                                clickSpan.end({ provider: 'google' });
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <span className="w-5 h-5 flex items-center justify-center font-bold text-lg text-blue-500">
                                    G
                                </span>
                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-medium text-foreground">
                                        Continue with Google
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Use your Google account
                                    </span>
                                </div>
                            </div>
                        </Button>

                        <Button
                            variant="surface"
                            size="tile"
                            className="w-full justify-start"
                            onClick={() => {
                                const clickSpan = FrontendProfiler.startSpan('auth:skip_login_click', 'frontend_interaction');
                                FrontendProfiler.trackInteraction('button_click', { button: 'skip_login' });
                                FrontendProfiler.profileSync('auth:skip_login_handler', 'frontend_interaction', () => {
                                    handleSkipLogin();
                                }, { action: 'skip' });
                                clickSpan.end({ action: 'skip' });
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <LogOutIcon className="h-5 w-5 text-muted-foreground" />
                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-medium text-foreground">
                                        Continue without login
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Use Fluxel without connecting accounts
                                    </span>
                                </div>
                            </div>
                        </Button>
                    </div>

                    <div className="text-xs text-muted-foreground pt-8">
                        <p>
                            By signing up, you agree to our{" "}
                            <a href="#" className="underline hover:text-foreground">
                                Privacy Policy
                            </a>{" "}
                            and{" "}
                            <a href="#" className="underline hover:text-foreground">
                                Terms of Service
                            </a>
                            .
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Right Panel - Visual Aurora */}
            <div className="hidden lg:block lg:w-1/2 relative">
                <div className="absolute inset-0 z-0">
                    <AuthAuroraBackdrop />
                </div>
            </div>
        </div>
    );
}
