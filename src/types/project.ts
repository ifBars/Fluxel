export type ProjectKind = 'dotnet' | 'javascript' | 'mixed' | 'unknown';

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

export interface DotnetInfo {
  solution_path: string | null;
  project_path: string | null;
}

export interface NodeInfo {
  has_package_json: boolean;
  has_tsconfig: boolean;
  has_jsconfig: boolean;
  package_manager: PackageManager | null;
}

export interface ProjectProfile {
  root_path: string;
  kind: ProjectKind;
  dotnet: DotnetInfo;
  node: NodeInfo;
  build_system_hint: string | null;
}

