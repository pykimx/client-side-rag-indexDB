/*
  file name: worker.js
  file description: Web Worker script responsible for background tasks: initializing AI models (embedding and LLM SDKs), processing documents into chunks, generating embeddings, storing/retrieving from IndexedDB, performing semantic search, and interacting with LLM APIs.
  author: Google Gemini, AI Assistant
  date created: 2024-06-07
  version number: 1.0
  AI WARNING: This file is generated with AI assistance. Please review and verify the content before use.
*/
  let embeddingPipeline;
  let db;
  
  // LLM SDKs and Configs
  let GoogleGenAI_SDK; // To store the imported GoogleGenAI class
  let GEMINI_API_KEY = ''; 
  let GOOGLE_GENAI_CDN_URL = '';
  
  let SELECTED_LLM_PROVIDER = 'ollama'; // Default provider, can be 'gemini', 'openai', or 'ollama'
  let OPENAI_API_KEY = '';
  let OLLAMA_BASE_URL = '';
  let ACTIVE_GENERATION_MODEL = ''; // Unified variable for the current generation model

  // Embedding Model
  let currentActiveEmbeddingModel = null; // Stores the name of the currently loaded embedding model

  // Configuration
  const DB_NAME = 'ClientSideRAGDB';
  const DB_VERSION = 1;
  const CHUNK_STORE_NAME = 'chunks';

  async function initializeLibraries(transformersJsUrl, genAiCdnUrl, embeddingModelToLoad) {
    try {
      self.postMessage({ type: 'PROGRESS', payload: { message: 'Loading helper libraries...' }});
      const { pipeline, env } = await import(transformersJsUrl);
      env.allowLocalModels = false; 
      env.useBrowserCache = true;  

      self.postMessage({ type: 'PROGRESS', payload: { message: `Loading embedding model: ${embeddingModelToLoad.split('/')[1]}... (this may take a moment)` }});
      embeddingPipeline = await pipeline('feature-extraction', embeddingModelToLoad, {
        quantized: true, 
      });
      currentActiveEmbeddingModel = embeddingModelToLoad; // Set the active model name after successful load
      self.postMessage({ type: 'PROGRESS', payload: { message: `Embedding model ${embeddingModelToLoad.split('/')[1]} loaded.` }});

      if (SELECTED_LLM_PROVIDER === 'gemini') {
        if (!GOOGLE_GENAI_CDN_URL) {
            throw new Error('Google GenAI SDK CDN URL is missing for Gemini provider.');
        }
        if (!GoogleGenAI_SDK) { 
            self.postMessage({ type: 'PROGRESS', payload: { message: 'Loading Google GenAI SDK...' }});
            const genAiModule = await import(GOOGLE_GENAI_CDN_URL);
            GoogleGenAI_SDK = genAiModule.GoogleGenAI;
            if (!GoogleGenAI_SDK) {
                throw new Error('Failed to import GoogleGenAI class from SDK module.');
            }
            self.postMessage({ type: 'PROGRESS', payload: { message: 'Google GenAI SDK loaded.' }});
        }
      }
    } catch (error) {
      console.error('Error loading libraries in worker:', error);
      self.postMessage({ type: 'ERROR', payload: { message: `Failed to load essential libraries: ${String(error.message || error)}` } });
      throw error; 
    }
  }

  function initDB() {
    return new Promise((resolve, reject) => {
      self.postMessage({ type: 'PROGRESS', payload: { message: 'Initializing database...' }});
      const request = self.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (event) => reject(`IndexedDB error: ${event.target.error?.message || event.target.error}`);
      request.onsuccess = (event) => {
        db = event.target.result;
        self.postMessage({ type: 'PROGRESS', payload: { message: 'Database initialized.' }});
        resolve(db);
      };
      request.onupgradeneeded = (event) => {
        const tempDb = event.target.result;
        if (!tempDb.objectStoreNames.contains(CHUNK_STORE_NAME)) {
          tempDb.createObjectStore(CHUNK_STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  async function getEmbedding(text) {
    if (!embeddingPipeline) throw new Error('Embedding pipeline not initialized.');
    const result = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  function clearObjectStore() {
    return new Promise((resolve, reject) => {
      if (!db) { reject("DB not initialized for clear"); return; }
      const transaction = db.transaction([CHUNK_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CHUNK_STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => {
        self.postMessage({ type: 'PROGRESS', payload: { message: 'Document context (IndexedDB) cleared.' }});
        resolve();
      };
      request.onerror = (event) => reject(`Failed to clear object store: ${event.target.error?.message || event.target.error}`);
    });
  }

  function storeChunk(chunk) {
    return new Promise((resolve, reject) => {
      if (!db) { reject("DB not initialized for store"); return; }
      const transaction = db.transaction([CHUNK_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CHUNK_STORE_NAME);
      const request = store.put(chunk);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(`Failed to store chunk: ${event.target.error?.message || event.target.error}`);
    });
  }
  
  async function processAndStore(text) {
    if (!db || !embeddingPipeline) {
      self.postMessage({ type: 'ERROR', payload: { message: 'Worker not fully initialized for processing.' }});
      return;
    }
    try {
      const rawChunks = text.split(/\n\s*\n/); 
      const chunks = rawChunks.map(p => p.trim()).filter(p => p.length > 20);

      if (chunks.length === 0) {
        self.postMessage({ type: 'PROGRESS', payload: { message: 'No suitable text chunks found after filtering (min length 20 chars).' } });
        self.postMessage({ type: 'DONE_PROCESSING' });
        return;
      }
      
      self.postMessage({ type: 'PROGRESS', payload: { message: `Embedding ${chunks.length} chunks with ${currentActiveEmbeddingModel.split('/')[1]}...` }});
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        if (i % 5 === 0 || i === chunks.length -1) { 
             self.postMessage({ type: 'PROGRESS', payload: { message: `Embedding chunk ${i + 1} of ${chunks.length}...` } });
        }
        const vector = await getEmbedding(chunkText);
        await storeChunk({ id: `chunk_${Date.now()}_${i}`, text: chunkText, vector: vector });
      }
      self.postMessage({ type: 'PROGRESS', payload: { message: 'All chunks processed.' } });
      self.postMessage({ type: 'DONE_PROCESSING' });
    } catch (error) {
      self.postMessage({ type: 'ERROR', payload: { message: `Error processing document: ${String(error.message || error)}` } });
    }
  }

  function getAllChunks() {
    return new Promise((resolve, reject) => {
      if (!db) { reject("DB not initialized for get all"); return; }
      const transaction = db.transaction([CHUNK_STORE_NAME], 'readonly');
      const store = transaction.objectStore(CHUNK_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(`Failed to get all chunks: ${event.target.error?.message || event.target.error}`);
    });
  }

  function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0, magA = 0, magB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }
    magA = Math.sqrt(magA); magB = Math.sqrt(magB);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
  }

  async function search(query, topK = 3) {
    if (!db || !embeddingPipeline) throw new Error('Worker not initialized for search.');
    const queryVector = await getEmbedding(query);
    const allChunks = await getAllChunks();
    if (!allChunks || allChunks.length === 0) return [];
    const scoredChunks = allChunks.map(chunk => ({...chunk, score: cosineSimilarity(queryVector, chunk.vector) }));
    scoredChunks.sort((a, b) => b.score - a.score);
    return scoredChunks.slice(0, topK);
  }

  async function generateAnswerGemini(requestPrompt) {
    if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured.');
    if (!GoogleGenAI_SDK) throw new Error('Google GenAI SDK not initialized for Gemini.');
    if (!ACTIVE_GENERATION_MODEL) throw new Error('Gemini generation model not set.');

    const ai = new GoogleGenAI_SDK({ apiKey: GEMINI_API_KEY });
    const modelConfig = {
      temperature: 0.5, maxOutputTokens: 1024, topP: 0.95, topK: 64,
      systemInstruction: "You are a helpful AI assistant. Answer questions based on provided documents. If the document doesn't contain the answer, say so and answer generally if possible. Format your response using markdown."
    };
    const genAIResponse = await ai.models.generateContent({
      model: ACTIVE_GENERATION_MODEL, // Use the active generation model
      contents: requestPrompt,
      config: modelConfig
    });
    
    const answerText = genAIResponse.text;
    if (!answerText || answerText.trim() === "") {
        let blockMessage = 'No answer from Gemini or answer was empty.';
        if (genAIResponse.promptFeedback?.blockReason) {
            blockMessage += ` Blocked: ${genAIResponse.promptFeedback.blockReason}.`;
            if (genAIResponse.promptFeedback.blockReasonMessage) {
              blockMessage += ` ${genAIResponse.promptFeedback.blockReasonMessage}.`;
            }
        }
        throw new Error(blockMessage);
    }
    return answerText;
  }

  async function generateAnswerOpenAI(requestPrompt) {
    if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured.');
    if (!ACTIVE_GENERATION_MODEL) throw new Error('OpenAI generation model not set.');
    const API_URL = 'https://api.openai.com/v1/chat/completions';
    const systemMessage = "You are a helpful AI assistant. Answer questions based on provided documents. If the document doesn't contain the answer, say so and answer generally if possible. Format your response using markdown.";

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: ACTIVE_GENERATION_MODEL, // Use the active generation model
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: requestPrompt }
        ],
        temperature: 0.5,
        max_tokens: 1024,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`OpenAI API Error (${response.status}): ${errorData.error?.message || errorData.message || 'Unknown error'}`);
    }
    const data = await response.json();
    const answerText = data.choices?.[0]?.message?.content;
    if (!answerText || answerText.trim() === "") {
      throw new Error('No answer from OpenAI or answer was empty.');
    }
    return answerText;
  }

  async function generateAnswerOllama(requestPrompt) {
    if (!OLLAMA_BASE_URL) throw new Error('Ollama base URL not configured.');
    if (!ACTIVE_GENERATION_MODEL) throw new Error('Ollama generation model not set.');

    const API_URL = `${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/generate`;
    const systemMessage = "You are a helpful AI assistant. Answer questions based on provided documents. If the document doesn't contain the answer, say so and answer generally if possible. Format your response using markdown.";
    
    const payload = {
      model: ACTIVE_GENERATION_MODEL, // Use the active generation model
      prompt: requestPrompt, 
      system: systemMessage,
      stream: false, 
      options: {
        temperature: 0.5,
      }
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Ollama API Error (${response.status}): ${errorText || 'Unknown error'}`);
    }
    const data = await response.json();
    const answerText = data.response; 
    if (!answerText || answerText.trim() === "") {
      throw new Error('No answer from Ollama or answer was empty.');
    }
    return answerText;
  }

  async function generateAnswer(query) {
    try {
      self.postMessage({ type: 'PROGRESS', payload: { message: 'Searching relevant document chunks...' }});
      const contextChunks = await search(query, 3); 

      let contextText = "No relevant context found in the document.";
      if (contextChunks && contextChunks.length > 0) {
        contextText = contextChunks.map((chunk, index) => `Context Snippet ${index + 1}:\n${chunk.text}`).join('\\n\\n---\\n\\n');
      }
      
      const requestPrompt = `Based on the following document context, please answer the query.
Context from document:
---
${contextText}
---
User Query: ${query}

Your Answer (respond in markdown format):
`;
      
      self.postMessage({ type: 'PROGRESS', payload: { message: `Sending query to ${SELECTED_LLM_PROVIDER} using model ${ACTIVE_GENERATION_MODEL}...` }});
      let answerText = '';

      switch (SELECTED_LLM_PROVIDER) {
        case 'gemini':
          answerText = await generateAnswerGemini(requestPrompt);
          break;
        case 'openai':
          answerText = await generateAnswerOpenAI(requestPrompt);
          break;
        case 'ollama':
          answerText = await generateAnswerOllama(requestPrompt);
          break;
        default:
          throw new Error(`Unsupported LLM provider: ${SELECTED_LLM_PROVIDER}`);
      }
      self.postMessage({ type: 'ANSWER', payload: { answer: answerText } });

    } catch (error) {
      console.error('Error generating answer in worker:', error);
      self.postMessage({ type: 'ERROR', payload: { message: `Error generating answer: ${String(error.message || error)}` } });
    }
  }

  self.onmessage = async (event) => {
    const { type, payload } = event.data;
    try {
      switch (type) {
        case 'INIT_WORKER':
          GEMINI_API_KEY = payload.apiKey || '';
          GOOGLE_GENAI_CDN_URL = payload.googleGenAiCdnUrl || '';
          SELECTED_LLM_PROVIDER = payload.llmProvider || 'gemini';
          OPENAI_API_KEY = payload.openAIApiKey || '';
          OLLAMA_BASE_URL = payload.ollamaBaseUrl || 'http://localhost:11434';
          ACTIVE_GENERATION_MODEL = payload.generationModelName || ''; // Unified generation model
          
          const newEmbeddingModel = payload.embeddingModelName || 'Xenova/all-MiniLM-L6-v2'; // Default if not provided

          if (currentActiveEmbeddingModel && currentActiveEmbeddingModel !== newEmbeddingModel) {
            self.postMessage({ type: 'PROGRESS', payload: { message: `Embedding model changed. Clearing old context for ${currentActiveEmbeddingModel.split('/')[1]}...` }});
            await clearObjectStore(); 
          }
          
          await initializeLibraries(payload.transformersJsUrl, GOOGLE_GENAI_CDN_URL, newEmbeddingModel);
          await initDB(); // Ensure DB is initialized or re-opened
          self.postMessage({ type: 'WORKER_READY', 
            payload: { 
              message: `Worker ready. Provider: ${SELECTED_LLM_PROVIDER}, Embedding: ${newEmbeddingModel.split('/')[1]}, Generation: ${ACTIVE_GENERATION_MODEL || 'Default'}.` 
            } 
          });
          break;
        case 'PROCESS_DOCUMENT':
          if (!payload.text) {
            self.postMessage({ type: 'ERROR', payload: { message: 'No text provided for document processing.' }});
            return;
          }
          await processAndStore(payload.text);
          break;
        case 'QUERY':
          if (!payload.query) {
            self.postMessage({ type: 'ERROR', payload: { message: 'No query provided.' }});
            return;
          }
          await generateAnswer(payload.query);
          break;
        case 'CLEAR_CONTEXT':
          self.postMessage({ type: 'PROGRESS', payload: { message: 'Clearing stored document context...' }});
          await clearObjectStore();
          self.postMessage({ type: 'CONTEXT_CLEARED', payload: {} });
          break;
        default:
          console.warn(`Unknown message type received in worker: ${type}`);
      }
    } catch (error) {
        let errorMessage = 'An unknown error occurred in the worker.';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else {
            try {
                errorMessage = JSON.stringify(error);
            } catch (e) {
                // Keep default
            }
        }
        console.error('General error in worker onmessage:', error);
        self.postMessage({ type: 'ERROR', payload: { message: `Worker operation failed: ${errorMessage}` } });
    }
  };

  self.addEventListener('error', function(event) {
    console.error('Unhandled error in worker (global handler):', event.error || event.message, event);
    try {
      self.postMessage({ type: 'ERROR', payload: { message: `Critical unhandled worker error: ${event.error ? String(event.error.message || event.error) : event.message}` } });
    } catch (e) {
      console.error("Failed to post critical error message from worker's global error handler", e);
    }
  });

  self.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection in worker (global handler):', event.reason);
    try {
      self.postMessage({ type: 'ERROR', payload: { message: `Critical unhandled promise rejection in worker: ${String(event.reason?.message || event.reason)}` } });
    } catch (e) {
       console.error("Failed to post critical unhandledrejection message from worker's global error handler", e);
    }
  });