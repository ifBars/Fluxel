//! MiniMax API proxy commands
//!
//! This module proxies MiniMax calls through the Tauri backend so the frontend can use
//! the model without browser CORS limitations.

use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

const DEFAULT_MINIMAX_BASE_URL: &str = "https://api.minimaxi.chat";
const MINIMAX_CHAT_PATH: &str = "/v1/text/chatcompletion_v2";
const DEFAULT_MODEL: &str = "MiniMax-M2.1";
const DEFAULT_MAX_TOKENS: u32 = 4096;
const MINIMAX_MAX_OUTPUT_TOKENS: u32 = 196_608;

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

/// Function definition for MiniMax tool use.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxFunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// Tool definition for MiniMax API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: MinimaxFunctionDefinition,
}

/// Function call payload used by MiniMax tool calls.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxFunctionCall {
    pub name: String,
    pub arguments: String,
}

/// Tool call payload used in MiniMax messages.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxToolCall {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: MinimaxFunctionCall,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

/// Message structure for MiniMax API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<MinimaxToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// Request structure for MiniMax API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxRequest {
    pub model: String,
    pub messages: Vec<MinimaxMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<MinimaxToolDefinition>>,
}

#[derive(Debug, Serialize)]
struct MinimaxChatRequest {
    model: String,
    messages: Vec<MinimaxMessage>,
    max_tokens: u32,
    temperature: f32,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<MinimaxToolDefinition>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_choice: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parallel_tool_calls: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "reasoning_split")]
    reasoning_split: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct MinimaxChatResponse {
    choices: Vec<MinimaxChoice>,
}

#[derive(Debug, Deserialize)]
struct MinimaxChoice {
    message: MinimaxResponseMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct MinimaxResponseMessage {
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    reasoning_content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<MinimaxToolCall>>,
}

#[derive(Debug, Deserialize)]
struct MinimaxStreamChunk {
    #[serde(default)]
    choices: Vec<MinimaxStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct MinimaxStreamChoice {
    #[serde(default)]
    delta: Option<MinimaxStreamDelta>,
    #[serde(default)]
    message: Option<MinimaxResponseMessage>,
}

#[derive(Debug, Deserialize, Default)]
struct MinimaxStreamDelta {
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    reasoning_content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<MinimaxToolCallDelta>>,
}

#[derive(Debug, Deserialize)]
struct MinimaxToolCallDelta {
    #[serde(default)]
    index: Option<usize>,
    #[serde(rename = "type", default)]
    tool_type: Option<String>,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    function: Option<MinimaxFunctionCallDelta>,
}

#[derive(Debug, Deserialize, Default)]
struct MinimaxFunctionCallDelta {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<String>,
}

#[derive(Debug, Default)]
struct MinimaxToolCallAccumulator {
    tool_type: String,
    function_name: String,
    arguments: String,
    id: String,
}

fn normalize_model(model: String) -> String {
    if model.trim().is_empty() {
        DEFAULT_MODEL.to_string()
    } else {
        model
    }
}

fn normalize_max_tokens(requested: Option<u32>) -> u32 {
    requested
        .unwrap_or(DEFAULT_MAX_TOKENS)
        .clamp(1, MINIMAX_MAX_OUTPUT_TOKENS)
}

fn resolve_endpoint(api_base: Option<&str>) -> String {
    let raw = api_base
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_MINIMAX_BASE_URL);

    let normalized = raw.trim_end_matches('/');
    if normalized.ends_with(MINIMAX_CHAT_PATH) {
        normalized.to_string()
    } else {
        format!("{normalized}{MINIMAX_CHAT_PATH}")
    }
}

fn parse_tool_arguments(arguments: &str) -> serde_json::Value {
    if arguments.trim().is_empty() {
        serde_json::json!({})
    } else {
        serde_json::from_str(arguments).unwrap_or_else(|_| serde_json::json!({}))
    }
}

fn collect_stream_tool_calls(
    accumulators: Vec<MinimaxToolCallAccumulator>,
    full_tool_calls: Vec<MinimaxToolCall>,
) -> Vec<MinimaxToolCall> {
    if !accumulators.is_empty() {
        return accumulators
            .into_iter()
            .filter_map(|entry| {
                if entry.function_name.trim().is_empty() {
                    return None;
                }

                Some(MinimaxToolCall {
                    tool_type: if entry.tool_type.trim().is_empty() {
                        "function".to_string()
                    } else {
                        entry.tool_type
                    },
                    function: MinimaxFunctionCall {
                        name: entry.function_name,
                        arguments: entry.arguments,
                    },
                    id: if entry.id.trim().is_empty() {
                        None
                    } else {
                        Some(entry.id)
                    },
                })
            })
            .collect();
    }

    full_tool_calls
}

fn emit_stream_error(window: &tauri::Window, event_name: &str, message: String) {
    let _ = window.emit(event_name, StreamChunk::Error { message });
}

fn process_minimax_stream_line(
    line: &str,
    content: &mut String,
    reasoning: &mut String,
    tool_call_accumulators: &mut Vec<MinimaxToolCallAccumulator>,
    full_tool_calls: &mut Vec<MinimaxToolCall>,
    saw_content_delta: &mut bool,
    on_delta: &mut (dyn FnMut(StreamChunk) -> Result<(), String> + Send),
) -> Result<bool, String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(false);
    }
    if trimmed.starts_with(':') || trimmed.starts_with("event:") {
        return Ok(false);
    }

    let payload = if let Some(raw) = trimmed.strip_prefix("data:") {
        raw.trim()
    } else {
        trimmed
    };

    if payload.is_empty() {
        return Ok(false);
    }
    if payload == "[DONE]" {
        return Ok(true);
    }

    let chunk: MinimaxStreamChunk = match serde_json::from_str(payload) {
        Ok(value) => value,
        Err(_) => return Ok(false),
    };

    for choice in chunk.choices {
        if let Some(delta) = choice.delta {
            if let Some(delta_content) = delta.content {
                if !delta_content.is_empty() {
                    *saw_content_delta = true;
                    content.push_str(&delta_content);
                    on_delta(StreamChunk::Text {
                        content: delta_content,
                    })?;
                }
            }

            if let Some(delta_reasoning) = delta.reasoning_content {
                if !delta_reasoning.is_empty() {
                    reasoning.push_str(&delta_reasoning);
                    on_delta(StreamChunk::Thinking {
                        content: delta_reasoning,
                    })?;
                }
            }

            if let Some(tool_calls) = delta.tool_calls {
                for call in tool_calls {
                    let idx = call.index.unwrap_or(0);
                    if tool_call_accumulators.len() <= idx {
                        tool_call_accumulators
                            .resize_with(idx + 1, MinimaxToolCallAccumulator::default);
                    }

                    let entry = &mut tool_call_accumulators[idx];
                    if let Some(id) = call.id {
                        if !id.is_empty() {
                            entry.id = id;
                        }
                    }
                    if let Some(tool_type) = call.tool_type {
                        if !tool_type.is_empty() {
                            entry.tool_type = tool_type;
                        }
                    }
                    if let Some(function) = call.function {
                        if let Some(name) = function.name {
                            if !name.is_empty() {
                                entry.function_name.push_str(&name);
                            }
                        }
                        if let Some(arguments) = function.arguments {
                            if !arguments.is_empty() {
                                entry.arguments.push_str(&arguments);
                            }
                        }
                    }
                }
            }
        }

        if let Some(message) = choice.message {
            if !*saw_content_delta {
                if let Some(message_content) = message.content {
                    if !message_content.is_empty() {
                        content.push_str(&message_content);
                        on_delta(StreamChunk::Text {
                            content: message_content,
                        })?;
                    }
                }
            }

            if reasoning.is_empty() {
                if let Some(message_reasoning) = message.reasoning_content {
                    if !message_reasoning.is_empty() {
                        reasoning.push_str(&message_reasoning);
                        on_delta(StreamChunk::Thinking {
                            content: message_reasoning,
                        })?;
                    }
                }
            }

            if let Some(tool_calls) = message.tool_calls {
                if !tool_calls.is_empty() {
                    full_tool_calls.extend(tool_calls);
                }
            }
        }
    }

    Ok(false)
}

/// Non-streaming chat completion.
#[tauri::command]
pub async fn minimax_chat(
    api_key: String,
    request: MinimaxRequest,
    api_base: Option<String>,
) -> Result<serde_json::Value, String> {
    let endpoint = resolve_endpoint(api_base.as_deref());
    let model = normalize_model(request.model);
    let max_tokens = normalize_max_tokens(request.max_tokens);

    let tools = request.tools;
    let tool_choice = tools.as_ref().map(|_| "auto".to_string());
    let parallel_tool_calls = tools.as_ref().map(|_| true);

    let body = MinimaxChatRequest {
        model,
        messages: request.messages,
        max_tokens,
        temperature: request.temperature.unwrap_or(0.1),
        stream: false,
        tools,
        tool_choice,
        parallel_tool_calls,
        reasoning_split: Some(true),
    };

    let response = reqwest::Client::new()
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))?;

    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(format!("MiniMax auth failed ({status}): {text}"));
    }
    if !status.is_success() {
        return Err(format!("MiniMax error {status}: {text}"));
    }

    let parsed: MinimaxChatResponse =
        serde_json::from_str(&text).map_err(|e| format!("Failed to parse response: {e}"))?;

    let message = parsed
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message)
        .ok_or_else(|| "MiniMax response missing choices[0].message".to_string())?;

    serde_json::to_value(message).map_err(|e| format!("Failed to serialize response: {e}"))
}

/// Streaming chat completion - emits events to frontend.
#[tauri::command]
pub async fn minimax_chat_stream(
    window: tauri::Window,
    api_key: String,
    request: MinimaxRequest,
    request_id: String,
    api_base: Option<String>,
) -> Result<(), String> {
    let event_name = format!("minimax_stream_{}", request_id);
    let endpoint = resolve_endpoint(api_base.as_deref());

    let model = normalize_model(request.model);
    let max_tokens = normalize_max_tokens(request.max_tokens);

    let tools = request.tools;
    let tool_choice = tools.as_ref().map(|_| "auto".to_string());
    let parallel_tool_calls = tools.as_ref().map(|_| true);

    let body = MinimaxChatRequest {
        model,
        messages: request.messages,
        max_tokens,
        temperature: request.temperature.unwrap_or(0.1),
        stream: true,
        tools,
        tool_choice,
        parallel_tool_calls,
        reasoning_split: Some(true),
    };

    let response = match reqwest::Client::new()
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let message = format!("Request failed: {e}");
            emit_stream_error(&window, &event_name, message.clone());
            return Err(message);
        }
    };

    let status = response.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        let body = response.text().await.unwrap_or_default();
        let message = format!("MiniMax auth failed ({status}): {body}");
        emit_stream_error(&window, &event_name, message.clone());
        return Err(message);
    }
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        let message = format!("MiniMax error {status}: {body}");
        emit_stream_error(&window, &event_name, message.clone());
        return Err(message);
    }

    let mut content = String::new();
    let mut reasoning = String::new();
    let mut tool_call_accumulators: Vec<MinimaxToolCallAccumulator> = Vec::new();
    let mut full_tool_calls: Vec<MinimaxToolCall> = Vec::new();
    let mut saw_content_delta = false;

    let mut emit_delta = |chunk: StreamChunk| -> Result<(), String> {
        window
            .emit(&event_name, chunk)
            .map_err(|e| format!("Failed to emit stream event: {e}"))
    };

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut done = false;

    while let Some(chunk) = stream.next().await {
        let bytes = match chunk {
            Ok(bytes) => bytes,
            Err(err) => {
                let message = format!("Stream error: {err}");
                emit_stream_error(&window, &event_name, message.clone());
                return Err(message);
            }
        };

        buffer.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(newline_idx) = buffer.find('\n') {
            let mut line = buffer[..newline_idx].to_string();
            if line.ends_with('\r') {
                line.pop();
            }
            buffer.drain(..=newline_idx);

            if process_minimax_stream_line(
                &line,
                &mut content,
                &mut reasoning,
                &mut tool_call_accumulators,
                &mut full_tool_calls,
                &mut saw_content_delta,
                &mut emit_delta,
            )? {
                done = true;
                break;
            }
        }

        if done {
            break;
        }
    }

    if !done && !buffer.trim().is_empty() {
        let _ = process_minimax_stream_line(
            buffer.trim_end_matches('\r'),
            &mut content,
            &mut reasoning,
            &mut tool_call_accumulators,
            &mut full_tool_calls,
            &mut saw_content_delta,
            &mut emit_delta,
        )?;
    }

    let tool_calls = collect_stream_tool_calls(tool_call_accumulators, full_tool_calls);
    for (index, call) in tool_calls.into_iter().enumerate() {
        if call.tool_type != "function" {
            continue;
        }
        if call.function.name.trim().is_empty() {
            continue;
        }

        let id = call.id.unwrap_or_else(|| format!("call_{index}"));
        let input = parse_tool_arguments(&call.function.arguments);
        emit_delta(StreamChunk::ToolUse {
            id,
            name: call.function.name,
            input,
        })?;
    }

    emit_delta(StreamChunk::Done)
}

/// Health check for MiniMax API.
#[tauri::command]
pub async fn minimax_health_check(
    api_key: String,
    api_base: Option<String>,
) -> Result<bool, String> {
    let endpoint = resolve_endpoint(api_base.as_deref());

    let body = MinimaxChatRequest {
        model: DEFAULT_MODEL.to_string(),
        messages: vec![MinimaxMessage {
            role: "user".to_string(),
            content: Some("Hi".to_string()),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        }],
        max_tokens: 10,
        temperature: 0.1,
        stream: false,
        tools: None,
        tool_choice: None,
        parallel_tool_calls: None,
        reasoning_split: Some(true),
    };

    let response = reqwest::Client::new()
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Health check failed: {e}"))?;

    Ok(response.status().is_success())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_endpoint_accepts_base_or_full_path() {
        assert_eq!(
            resolve_endpoint(None),
            "https://api.minimaxi.chat/v1/text/chatcompletion_v2"
        );
        assert_eq!(
            resolve_endpoint(Some("https://api.minimaxi.chat")),
            "https://api.minimaxi.chat/v1/text/chatcompletion_v2"
        );
        assert_eq!(
            resolve_endpoint(Some("https://api.minimaxi.chat/v1/text/chatcompletion_v2")),
            "https://api.minimaxi.chat/v1/text/chatcompletion_v2"
        );
    }

    #[test]
    fn parse_tool_arguments_falls_back_to_empty_object() {
        assert_eq!(parse_tool_arguments(""), serde_json::json!({}));
        assert_eq!(parse_tool_arguments("{invalid}"), serde_json::json!({}));
        assert_eq!(
            parse_tool_arguments("{\"path\":\"src/main.rs\"}"),
            serde_json::json!({"path":"src/main.rs"})
        );
    }

    #[test]
    fn process_stream_line_accumulates_tool_call_arguments() {
        let mut content = String::new();
        let mut reasoning = String::new();
        let mut accumulators = Vec::new();
        let mut full_tool_calls = Vec::new();
        let mut saw_content_delta = false;
        let mut deltas = Vec::new();
        let mut on_delta = |chunk: StreamChunk| -> Result<(), String> {
            deltas.push(chunk);
            Ok(())
        };

        let line1 = r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"read_file","arguments":"{\"path\":\""}}]}}]}"#;
        let line2 = r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"src/lib.rs\"}"}}]}}]}"#;

        assert!(!process_minimax_stream_line(
            line1,
            &mut content,
            &mut reasoning,
            &mut accumulators,
            &mut full_tool_calls,
            &mut saw_content_delta,
            &mut on_delta
        )
        .unwrap());
        assert!(!process_minimax_stream_line(
            line2,
            &mut content,
            &mut reasoning,
            &mut accumulators,
            &mut full_tool_calls,
            &mut saw_content_delta,
            &mut on_delta
        )
        .unwrap());

        assert!(deltas.is_empty());
        assert_eq!(accumulators.len(), 1);
        assert_eq!(accumulators[0].id, "call_1");
        assert_eq!(accumulators[0].tool_type, "function");
        assert_eq!(accumulators[0].function_name, "read_file");
        assert_eq!(accumulators[0].arguments, "{\"path\":\"src/lib.rs\"}");
    }
}
