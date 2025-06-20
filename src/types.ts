
/*
  file name: src/types.ts
  file description: Contains TypeScript type definitions and enums used across the application, defining data structures for application status, worker messages, and document chunks.
  author: Google Gemini, AI Assistant
  date created: 2024-06-07
  version number: 1.0
  AI WARNING: This file is generated with AI assistance. Please review and verify the content before use.
*/
export enum AppStatus {
  INITIALIZING = 'INITIALIZING',
  READY_FOR_DOCUMENT = 'READY_FOR_DOCUMENT',
  PROCESSING_DOCUMENT = 'PROCESSING_DOCUMENT',
  DOCUMENT_PROCESSED = 'DOCUMENT_PROCESSED', // Ready for query
  PROCESSING_QUERY = 'PROCESSING_QUERY',
  ANSWER_RECEIVED = 'ANSWER_RECEIVED', // Also ready for new query
  ERROR = 'ERROR',
}

export type LlmProvider = 'gemini' | 'openai' | 'ollama';

export interface WorkerMessagePayload {
  status?: AppStatus;
  message?: string;
  answer?: string;
  error?: string;
  // For INIT message to worker
  transformersJsUrl?: string;
  apiKey?: string; // For Gemini
  googleGenAiCdnUrl?: string;
  llmProvider?: LlmProvider;
  openAIApiKey?: string;
  ollamaBaseUrl?: string;
  embeddingModelName?: string; 
  generationModelName?: string; // Unified field for the generation model for the selected LLM provider
}

export interface WorkerMessage {
  type: string; // e.g., 'INIT', 'PROGRESS', 'DONE_PROCESSING', 'ANSWER', 'ERROR', 'WORKER_READY'
  payload: WorkerMessagePayload;
}

export interface DocumentChunk {
  id: string;
  text: string;
  vector: number[];
}

export interface ScoredChunk extends DocumentChunk {
  score: number;
}
