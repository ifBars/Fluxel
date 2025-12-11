import { useState, useRef, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Moon, Sun, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShader } from "./AuthShader";
import { useSettingsStore, type AccentColor } from "@/stores";

const accentColors: { value: AccentColor; label: string; color: string }[] = [
    { value: 'orange', label: 'Orange', color: 'bg-[#f97316]' },
    { value: 'blue', label: 'Blue', color: 'bg-[#3b82f6]' },
    { value: 'green', label: 'Green', color: 'bg-[#22c55e]' },
    { value: 'purple', label: 'Purple', color: 'bg-[#a855f7]' },
    { value: 'red', label: 'Red', color: 'bg-[#ef4444]' },
];

export default function AuthPage({ onLogin }: { onLogin: () => void }) {
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
                            <Moon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        ) : (
                            <Sun className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
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
                                            onClick={() => setTheme("light")}
                                            className={`flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${theme === "light"
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border hover:bg-muted/50 text-muted-foreground"
                                                }`}
                                        >
                                            <Sun size={14} />
                                            <span className="text-xs font-medium">Light</span>
                                            {theme === "light" && <Check size={12} />}
                                        </button>
                                        <button
                                            onClick={() => setTheme("dark")}
                                            className={`flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${theme === "dark"
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border hover:bg-muted/50 text-muted-foreground"
                                                }`}
                                        >
                                            <Moon size={14} />
                                            <span className="text-xs font-medium">Dark</span>
                                            {theme === "dark" && <Check size={12} />}
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
                                                onClick={() => setAccentColor(color.value)}
                                                className={`relative w-7 h-7 rounded-full ${color.color} transition-all hover:scale-110 ${accentColor === color.value ? "ring-2 ring-offset-2 ring-offset-card ring-foreground" : ""
                                                    }`}
                                                aria-label={color.label}
                                            >
                                                {accentColor === color.value && (
                                                    <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-md" />
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
                            onClick={onLogin}
                        >
                            <div className="flex items-center gap-3">
                                <Github className="h-5 w-5 text-muted-foreground" />
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
                            onClick={onLogin}
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

            {/* Right Panel - Visual Shader */}
            <div className="hidden lg:block lg:w-1/2 relative bg-[#050506]">
                <div className="absolute inset-0 z-0">
                    <Suspense fallback={<div className="w-full h-full bg-[#050506]" />}>
                        <AuthShader />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
