/**
 * MiniMax integration module
 * Exports client for MiniMax native chatcompletion_v2 API
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
    type MinimaxMessage,
} from './minimaxClient';

