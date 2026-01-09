/**
 * MiniMax integration module
 * Exports client for MiniMax M2.1 API with Anthropic compatibility
 */

export {
    streamMinimaxChat,
    chatMinimax,
    checkMinimaxHealth,
    getAvailableMinimaxModels,
    convertToolsToMinimaxFormat,
    MINIMAX_MODELS,
    type MinimaxModel,
    type MinimaxStreamChunk,
    type MinimaxChatRequest,
    type MinimaxToolDefinition,
} from './minimaxClient';
