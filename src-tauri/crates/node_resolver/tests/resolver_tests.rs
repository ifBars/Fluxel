use std::fs;
use std::io::Write;

use camino::Utf8PathBuf;
use fluxel_node_resolver::{
    analyze_module_native, discover_typings_native, resolve_module_native, AnalyzeResponse,
    ResolveOptions, ResolveRequest,
};
use tempfile::tempdir;

fn write_file(path: &Utf8PathBuf, contents: &str) {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).unwrap();
    }
    let mut file = std::fs::File::create(path).unwrap();
    file.write_all(contents.as_bytes()).unwrap();
}

#[test]
fn resolves_exports_with_conditions() {
    let dir = tempdir().unwrap();
    let project_root = Utf8PathBuf::from_path_buf(dir.path().to_path_buf()).unwrap();
    let node_modules = project_root.join("node_modules");
    let pkg_dir = node_modules.join("pkg");
    fs::create_dir_all(&pkg_dir).unwrap();

    write_file(
        &pkg_dir.join("package.json"),
        r#"{
  "name": "pkg",
  "exports": {
    ".": {
      "import": "./esm.js",
      "require": "./cjs.js",
      "default": "./esm.js"
    }
  }
}"#,
    );
    write_file(&pkg_dir.join("esm.js"), "export const hello = 1;");
    write_file(&pkg_dir.join("cjs.js"), "module.exports = { hello: 1 };");

    let importer = project_root.join("src/index.ts");
    write_file(&importer, "import { hello } from 'pkg'; console.log(hello);");

    let result = resolve_module_native(
        ResolveRequest {
            specifier: "pkg".into(),
            importer: importer.to_string(),
            project_root: Some(project_root.to_string()),
        },
        Some(ResolveOptions::default()),
    )
    .unwrap();

    assert!(result.resolved_path.is_some());
    assert!(result
        .resolved_path
        .unwrap()
        .ends_with("node_modules/pkg/esm.js"));
}

#[test]
fn discovers_typings_with_types_field() {
    let dir = tempdir().unwrap();
    let project_root = Utf8PathBuf::from_path_buf(dir.path().to_path_buf()).unwrap();
    let pkg_dir = project_root.join("node_modules/foo");
    fs::create_dir_all(&pkg_dir).unwrap();

    write_file(
        &pkg_dir.join("package.json"),
        r#"{
  "name": "foo",
  "types": "types/index.d.ts"
}"#,
    );
    write_file(&pkg_dir.join("types/index.d.ts"), "export interface Foo { value: number }");

    let typings = discover_typings_native("foo", &project_root).unwrap();
    assert_eq!(typings.package_name, "foo");
    assert_eq!(typings.files.len(), 1);
    assert!(typings.files[0].ends_with("types/index.d.ts"));
}

#[test]
fn analyzes_imports_and_exports() {
    let dir = tempdir().unwrap();
    let project_root = Utf8PathBuf::from_path_buf(dir.path().to_path_buf()).unwrap();
    let file = project_root.join("src/file.ts");
    write_file(
        &file,
        r#"
import foo from "./foo";
export const bar = 1;
export default foo;
"#,
    );

    let analysis: AnalyzeResponse = analyze_module_native(&file).unwrap();
    assert!(analysis.imports.contains(&"./foo".to_string()));
    assert!(analysis.exports.contains(&"bar".to_string()));
    assert!(analysis.exports.iter().any(|e| e.contains("default")));
}
