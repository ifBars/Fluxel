//! MiniMax API proxy commands
//!
//! This module provides Tauri commands to proxy MiniMax API calls from the frontend.
//! This is necessary because browser CORS restrictions prevent direct API calls.

use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

const MINIMAX_BASE_URL: &str = "https://api.minimax.io/anthropic/v1/messages";

/// Message structure for MiniMax API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxMessage {
    pub role: String,
    pub content: String,
}

/// Tool definition for MiniMax API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

/// Request structure for MiniMax API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxRequest {
    pub model: String,
    pub messages: Vec<MinimaxMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<MinimaxToolDefinition>>,
}

/// Stream chunk sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamChunk {
    Text {
        content: String,
    },
    Thinking {
        content: String,
    },
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    Done,
    Error {
        message: String,
    },
}

/// Non-streaming chat completion
#[tauri::command]
pub async fn minimax_chat(
    api_key: String,
    request: MinimaxRequest,
) -> Result<serde_json::Value, String> {
    println!(
        "[MiniMax] Non-streaming chat request for model: {}",
        request.model
    );

    let client = reqwest::Client::new();

    // Build the Anthropic-style request body
    let mut body = serde_json::json!({
        "model": request.model,
        "messages": request.messages,
        "max_tokens": request.max_tokens.unwrap_or(4096),
    });

    if let Some(system) = &request.system {
        body["system"] = serde_json::json!(system);
    }

    if let Some(temp) = request.temperature {
        body["temperature"] = serde_json::json!(temp);
    }

    if let Some(tools) = &request.tools {
        body["tools"] = serde_json::json!(tools);
    }

    let response = client
        .post(MINIMAX_BASE_URL)
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    println!("[MiniMax] Response status: {}", status);

    if !status.is_success() {
        return Err(format!("API error ({}): {}", status, text));
    }

    serde_json::from_str(&text).map_err(|e| format!("Failed to parse response: {}", e))
}

/// Streaming chat completion - emits events to frontend
#[tauri::command]
pub async fn minimax_chat_stream(
    window: tauri::Window,
    api_key: String,
    request: MinimaxRequest,
    request_id: String,
) -> Result<(), String> {
    println!(
        "[MiniMax] Streaming chat request for model: {}, request_id: {}",
        request.model, request_id
    );

    let event_name = format!("minimax_stream_{}", request_id);
    let client = reqwest::Client::new();

    // Build the Anthropic-style request body with streaming
    let mut body = serde_json::json!({
        "model": request.model,
        "messages": request.messages,
        "max_tokens": request.max_tokens.unwrap_or(4096),
        "stream": true,
    });

    if let Some(system) = &request.system {
        body["system"] = serde_json::json!(system);
    }

    if let Some(temp) = request.temperature {
        body["temperature"] = serde_json::json!(temp);
    }

    if let Some(tools) = &request.tools {
        body["tools"] = serde_json::json!(tools);
    }

    println!("[MiniMax] Sending request to {}", MINIMAX_BASE_URL);

    let response = match client
        .post(MINIMAX_BASE_URL)
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let error_msg = format!("Request failed: {}", e);
            println!("[MiniMax] {}", error_msg);
            let _ = window.emit(&event_name, StreamChunk::Error { message: error_msg });
            return Err("Connection failed".to_string());
        }
    };

    let status = response.status();
    println!("[MiniMax] Response status: {}", status);

    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        let error_msg = format!("API error ({}): {}", status, text);
        println!("[MiniMax] {}", error_msg);
        let _ = window.emit(&event_name, StreamChunk::Error { message: error_msg });
        return Err("API error".to_string());
    }

    // Process SSE stream
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    // Track the current tool being streamed
    let mut current_tool_id: Option<String> = None;
    let mut current_tool_name: Option<String> = None;
    let mut current_tool_input_json = String::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                buffer.push_str(&text);

                // Process complete SSE events (lines starting with "data: ")
                while let Some(newline_pos) = buffer.find('\n') {
                    let line = buffer[..newline_pos].trim().to_string();
                    buffer = buffer[newline_pos + 1..].to_string();

                    if line.is_empty()
                        || line == "event: message_start"
                        || line == "event: content_block_start"
                        || line == "event: content_block_delta"
                        || line == "event: content_block_stop"
                        || line == "event: message_delta"
                        || line == "event: message_stop"
                    {
                        continue;
                    }

                    if let Some(data) = line.strip_prefix("data: ") {
                        if data == "[DONE]" {
                            println!("[MiniMax] Stream complete");
                            let _ = window.emit(&event_name, StreamChunk::Done);
                            continue;
                        }

                        // Parse the SSE data as JSON
                        if let Ok(event) = serde_json::from_str::<serde_json::Value>(data) {
                            let event_type =
                                event.get("type").and_then(|v| v.as_str()).unwrap_or("");

                            match event_type {
                                "content_block_start" => {
                                    if let Some(block) = event.get("content_block") {
                                        let block_type = block
                                            .get("type")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("");

                                        if block_type == "tool_use" {
                                            current_tool_id = block
                                                .get("id")
                                                .and_then(|v| v.as_str())
                                                .map(String::from);
                                            current_tool_name = block
                                                .get("name")
                                                .and_then(|v| v.as_str())
                                                .map(String::from);
                                            current_tool_input_json.clear();
                                            println!(
                                                "[MiniMax] Tool block started: {:?}",
                                                current_tool_name
                                            );
                                        }
                                    }
                                }
                                "content_block_delta" => {
                                    if let Some(delta) = event.get("delta") {
                                        let delta_type = delta
                                            .get("type")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("");

                                        match delta_type {
                                            "text_delta" => {
                                                if let Some(text) =
                                                    delta.get("text").and_then(|v| v.as_str())
                                                {
                                                    let _ = window.emit(
                                                        &event_name,
                                                        StreamChunk::Text {
                                                            content: text.to_string(),
                                                        },
                                                    );
                                                }
                                            }
                                            "thinking_delta" => {
                                                if let Some(thinking) =
                                                    delta.get("thinking").and_then(|v| v.as_str())
                                                {
                                                    let _ = window.emit(
                                                        &event_name,
                                                        StreamChunk::Thinking {
                                                            content: thinking.to_string(),
                                                        },
                                                    );
                                                }
                                            }
                                            "input_json_delta" => {
                                                // Accumulate tool input JSON
                                                if let Some(partial_json) = delta
                                                    .get("partial_json")
                                                    .and_then(|v| v.as_str())
                                                {
                                                    current_tool_input_json.push_str(partial_json);
                                                }
                                            }
                                            _ => {}
                                        }
                                    }
                                }
                                "content_block_stop" => {
                                    // If we were building a tool, emit it now with complete input
                                    if let (Some(id), Some(name)) =
                                        (current_tool_id.take(), current_tool_name.take())
                                    {
                                        let input: serde_json::Value =
                                            if current_tool_input_json.is_empty() {
                                                serde_json::json!({})
                                            } else {
                                                serde_json::from_str(&current_tool_input_json)
                                                    .unwrap_or(serde_json::json!({}))
                                            };

                                        println!(
                                            "[MiniMax] Emitting tool_use: {} with input: {}",
                                            name, input
                                        );
                                        let _ = window.emit(
                                            &event_name,
                                            StreamChunk::ToolUse { id, name, input },
                                        );
                                        current_tool_input_json.clear();
                                    }
                                }
                                "message_stop" => {
                                    let _ = window.emit(&event_name, StreamChunk::Done);
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
            Err(e) => {
                let error_msg = format!("Stream error: {}", e);
                println!("[MiniMax] {}", error_msg);
                let _ = window.emit(&event_name, StreamChunk::Error { message: error_msg });
                break;
            }
        }
    }

    // Emit done if we haven't already
    let _ = window.emit(&event_name, StreamChunk::Done);

    Ok(())
}

/// Health check for MiniMax API
#[tauri::command]
pub async fn minimax_health_check(api_key: String) -> Result<bool, String> {
    println!("[MiniMax] Health check...");

    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "model": "MiniMax-M2.1",
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 10,
    });

    let response = client
        .post(MINIMAX_BASE_URL)
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Health check failed: {}", e))?;

    let status = response.status();
    println!("[MiniMax] Health check status: {}", status);

    Ok(status.is_success())
}
