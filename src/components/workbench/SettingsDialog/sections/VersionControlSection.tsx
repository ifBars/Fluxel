import type { SettingsState } from "@/stores";

export function VersionControlSection({ settings }: { settings: SettingsState }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Version Control</h3>
        <p className="text-sm text-muted-foreground">
          Configure Git and GitHub integration
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          GitHub Personal Access Token
        </label>
        <input
          type="password"
          value={settings.githubToken}
          onChange={(e) => settings.setGithubToken(e.target.value)}
          placeholder="ghp_..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Required for push/pull operations. Create one at{" "}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            GitHub Settings
          </a>
          . Scopes needed: <code>repo</code>
        </p>
      </div>
    </div>
  );
}
