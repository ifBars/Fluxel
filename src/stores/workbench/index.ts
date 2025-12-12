export { useWorkbenchStore } from './useWorkbenchStore';
export type { WorkbenchState, ActivityItem, EditorMode } from './useWorkbenchStore';

export { useSettingsStore, densityConfigs } from './useSettingsStore';
export type {
  SettingsState,
  Theme,
  AccentColor,
  UIDensity,
  IconPack,
  BuildSystem,
  DensityConfig,
  // Editor customization types
  CursorStyle,
  CursorBlinking,
  CursorSmoothCaretAnimation,
  RenderWhitespace,
  LineNumbers,
  RenderLineHighlight,
  WordWrapMode,
  AutoClosingBehavior,
  MinimapSide,
  MinimapShowSlider,
  EditorFontFamily,
  EditorFontWeight,
} from './useSettingsStore';

export { useInspectorStore } from './useInspectorStore';
export type { InspectorState, InspectorTab, PendingChange } from './useInspectorStore';

