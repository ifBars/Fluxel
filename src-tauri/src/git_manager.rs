use git2::{Cred, PushOptions, RemoteCallbacks, Repository, Status, StatusOptions};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatusResult {
    pub branch: String,
    pub files: Vec<GitFileStatus>,
}

#[tauri::command]
pub async fn git_status(root_path: String) -> Result<GitStatusResult, String> {
    // Run blocking git operations in a separate thread
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&root_path).map_err(|e| e.to_string())?;

        // Get current branch name
        let head = repo.head().ok();
        let branch = head
            .as_ref()
            .and_then(|h| h.shorthand())
            .unwrap_or("HEAD")
            .to_string();

        let mut status_opts = StatusOptions::new();
        status_opts.include_untracked(true);

        let statuses = repo
            .statuses(Some(&mut status_opts))
            .map_err(|e| e.to_string())?;

        let mut files = Vec::new();

        for entry in statuses.iter() {
            let status = entry.status();
            let path = entry.path().unwrap_or("").to_string();

            let status_str = if status.contains(Status::INDEX_NEW)
                || status.contains(Status::WT_NEW)
            {
                "new"
            } else if status.contains(Status::INDEX_MODIFIED)
                || status.contains(Status::WT_MODIFIED)
            {
                "modified"
            } else if status.contains(Status::INDEX_DELETED) || status.contains(Status::WT_DELETED)
            {
                "deleted"
            } else if status.contains(Status::INDEX_RENAMED) || status.contains(Status::WT_RENAMED)
            {
                "renamed"
            } else if status.contains(Status::CONFLICTED) {
                "conflicted"
            } else {
                "unknown"
            };

            files.push(GitFileStatus {
                path,
                status: status_str.to_string(),
            });
        }

        Ok(GitStatusResult { branch, files })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_commit(root_path: String, message: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&root_path).map_err(|e| e.to_string())?;

        // Add all changed files to index (simplified workflow for now)
        let mut index = repo.index().map_err(|e| e.to_string())?;
        index
            .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .map_err(|e| e.to_string())?;
        index.write().map_err(|e| e.to_string())?;

        let tree_id = index.write_tree().map_err(|e| e.to_string())?;
        let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;

        let sig = repo
            .signature()
            .or_else(|_| {
                // Fallback if no user config
                git2::Signature::now("Fluxel User", "user@fluxel.app")
            })
            .map_err(|e| e.to_string())?;

        let parent_commit = match repo.head() {
            Ok(head) => {
                let target = head.target().unwrap();
                Some(repo.find_commit(target).map_err(|e| e.to_string())?)
            }
            Err(_) => None, // Initial commit
        };

        let parents: Vec<&git2::Commit> = match &parent_commit {
            Some(c) => vec![c],
            None => vec![],
        };

        repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
            .map_err(|e| e.to_string())?;

        Ok("Committed successfully".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_push(root_path: String, token: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&root_path).map_err(|e| e.to_string())?;
        let mut remote = repo.find_remote("origin").map_err(|e| e.to_string())?;

        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(|_url, _username_from_url, _allowed_types| {
            Cred::userpass_plaintext("oauth2", &token)
        });

        // We need to use PushOptions to set callbacks
        let mut push_options = PushOptions::new();
        push_options.remote_callbacks(callbacks);

        // Get current branch to push
        let head = repo.head().map_err(|e| e.to_string())?;
        let branch_name = head.shorthand().ok_or("Detached HEAD")?;
        let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

        remote
            .push(&[&refspec], Some(&mut push_options))
            .map_err(|e| e.to_string())?;

        Ok("Push successful".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_pull(root_path: String, token: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&root_path).map_err(|e| e.to_string())?;
        let mut remote = repo.find_remote("origin").map_err(|e| e.to_string())?;

        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(|_url, _username_from_url, _allowed_types| {
            Cred::userpass_plaintext("oauth2", &token)
        });

        // Fetch
        let mut fetch_options = git2::FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        let head = repo.head().map_err(|e| e.to_string())?;
        let branch_name = head.shorthand().ok_or("Detached HEAD")?;

        remote
            .fetch(&[branch_name], Some(&mut fetch_options), None)
            .map_err(|e| e.to_string())?;

        // Merge (simplified: fast-forward or simple merge)
        // In a real app we'd handle rebase/merge conflicts better
        let fetch_head = repo
            .find_reference("FETCH_HEAD")
            .map_err(|e| e.to_string())?;
        let fetch_commit = repo
            .reference_to_annotated_commit(&fetch_head)
            .map_err(|e| e.to_string())?;

        let analysis = repo
            .merge_analysis(&[&fetch_commit])
            .map_err(|e| e.to_string())?;

        if analysis.0.is_up_to_date() {
            Ok("Already up to date".to_string())
        } else if analysis.0.is_fast_forward() {
            let refname = format!("refs/heads/{}", branch_name);
            let mut reference = repo.find_reference(&refname).map_err(|e| e.to_string())?;
            reference
                .set_target(fetch_commit.id(), "Fast-forward")
                .map_err(|e| e.to_string())?;
            repo.set_head(&refname).map_err(|e| e.to_string())?;
            repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
                .map_err(|e| e.to_string())?;
            Ok("Fast-forward successful".to_string())
        } else {
            Err(
                "Merge required (non-fast-forward). Only fast-forward supported for now."
                    .to_string(),
            )
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_read_file_at_head(root_path: String, file_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&root_path).map_err(|e| e.to_string())?;

        let head = repo.head().map_err(|e| e.to_string())?;
        let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
        let tree = commit.tree().map_err(|e| e.to_string())?;

        // Find the entry in the tree
        // Note: file_path should be relative to repo root
        let entry = tree
            .get_path(std::path::Path::new(&file_path))
            .map_err(|_| format!("File {} not found in HEAD", file_path))?;

        let object = entry.to_object(&repo).map_err(|e| e.to_string())?;
        let blob = object.as_blob().ok_or("Not a blob")?;

        let content = std::str::from_utf8(blob.content())
            .map_err(|_| "File content is not valid UTF-8")?
            .to_string();

        Ok(content)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_discard_changes(root_path: String, file_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&root_path).map_err(|e| e.to_string())?;

        // Force checkout the specific file from HEAD
        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.path(&file_path);
        checkout_opts.force();

        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| e.to_string())?;

        Ok("Discarded changes successfully".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
