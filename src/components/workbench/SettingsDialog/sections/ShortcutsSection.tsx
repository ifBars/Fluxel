const keyboardShortcuts = [
  { command: "Toggle Sidebar", keys: "Ctrl/Cmd + B" },
  { command: "Focus Explorer", keys: "Ctrl/Cmd + Shift + E" },
  { command: "Focus Search", keys: "Ctrl/Cmd + Shift + F" },
  { command: "Focus Source Control", keys: "Ctrl/Cmd + Shift + G" },
];

export function ShortcutsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Keyboard Shortcuts</h3>
        <p className="text-sm text-muted-foreground">
          View available keyboard shortcuts
        </p>
      </div>

      <div className="space-y-2">
        {keyboardShortcuts.map((shortcut, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20"
          >
            <span className="text-sm font-medium text-foreground">
              {shortcut.command}
            </span>
            <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded">
              {shortcut.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
