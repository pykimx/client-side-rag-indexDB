
/*
  file name: src/App.tsx
  file description: The main React application component. Manages application state, UI rendering, user interactions, and communication with the Web Worker for document processing and RAG.
  author: Google Gemini, AI Assistant
  date created: 2024-06-07
  version number: 1.2 (Vite compatible)
  AI WARNING: This file is generated with AI assistance. Please review and verify the content before use.
*/
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStatus, WorkerMessage, LlmProvider } from './types'; // Adjusted path
import StatusIndicator from './components/StatusIndicator'; // Adjusted path
import StepCard from './components/StepCard'; // Adjusted path

// Make pdfjs global available for TypeScript
declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
  }
}

const EMBEDDING_MODELS_INFO = [
  { 
    name: 'Xenova/all-MiniLM-L6-v2', 
    displayName: 'all-MiniLM-L6-v2',
    description: "Default. A small, fast, and balanced model good for general semantic similarity. Great for client-side performance." 
  },
  { 
    name: 'Xenova/bge-small-en-v1.5', 
    displayName: 'bge-small-en-v1.5',
    description: "BAAI General Embedding. A strong performer in benchmarks, 'small' version optimized for efficiency. Good for higher quality retrieval."
  },
  { 
    name: 'Xenova/gte-small', 
    displayName: 'gte-small',
    description: "General Text Embeddings. Another compact and effective model, good alternative for general-purpose text embeddings with good performance."
  },
];

const OLLAMA_MODELS_CONFIG = [
  { id: 'llama3', name: 'Llama 3' },
  { id: 'mistral', name: 'Mistral' },
  { id: 'codellama:7b', name: 'CodeLlama 7B' },
];

const GENERATION_MODELS_CONFIG = {
  gemini: [
    { id: 'gemini-2.5-flash-preview-04-17', name: 'gemini-2.5-flash-preview-04-17 (Recommended)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
    { id: 'gpt-4-turbo', name: 'gpt-4-turbo' },
    { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo' },
  ],
  ollama: OLLAMA_MODELS_CONFIG // Use the new config here
};

const App = (): React.ReactNode => {
  const [documentText, setDocumentText] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [queryText, setQueryText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing...');
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.INITIALIZING);
  const [generatedAnswer, setGeneratedAnswer] = useState<string>('');
  
  const [llmProvider, setLlmProvider] = useState<LlmProvider>('gemini');
  const [embeddingModelName, setEmbeddingModelName] = useState<string>(EMBEDDING_MODELS_INFO[0].name);
  
  const [envConfigs, setEnvConfigs] = useState({
    geminiApiKey: null as string | null,
    openAIApiKey: null as string | null,
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModelName: GENERATION_MODELS_CONFIG.ollama[0].id // Default Ollama model from config
  });

  const [manualGeminiApiKey, setManualGeminiApiKey] = useState<string>('');
  const [manualOpenAIApiKey, setManualOpenAIApiKey] = useState<string>('');
  
  const [selectedGenerationModelByProvider, setSelectedGenerationModelByProvider] = useState({
    gemini: GENERATION_MODELS_CONFIG.gemini[0].id,
    openai: GENERATION_MODELS_CONFIG.openai[0].id,
    ollama: GENERATION_MODELS_CONFIG.ollama[0].id, 
  });
  
  const [configError, setConfigError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workerBlobUrl, setWorkerBlobUrl] = useState<string | null>(null);

  const transformersJsUrl = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';
  const googleGenAiCdnUrl = 'https://cdn.jsdelivr.net/npm/@google/genai/+esm';

  useEffect(() => {
    let objectUrl: string | null = null;

    const createWorkerBlobUrl = async () => {
      setStatusMessage('Loading worker script...');
      try {
        // With Vite, worker.js should be in the public directory and will be served at the root
        const response = await fetch('/worker.js'); 
        if (!response.ok) {
          throw new Error(`Failed to fetch worker script: ${response.status} ${response.statusText}`);
        }
        const workerScriptText = await response.text();
        const blob = new Blob([workerScriptText], { type: 'application/javascript' });
        objectUrl = URL.createObjectURL(blob);
        setWorkerBlobUrl(objectUrl);
        setStatusMessage('Worker script loaded.');
      } catch (error: any) {
        console.error('Error creating worker Blob URL:', error);
        const errorMsg = `Critical Error: Could not load worker script. ${error.message || String(error)}`;
        setStatusMessage(errorMsg);
        setConfigError(errorMsg);
        setAppStatus(AppStatus.ERROR);
      }
    };

    createWorkerBlobUrl();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setWorkerBlobUrl(null);
      }
    };
  }, []); 


  useEffect(() => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // Vite uses import.meta.env for environment variables, prefixed with VITE_
    // Fallback to null or defaults if not set.
    setEnvConfigs({
        geminiApiKey: import.meta.env.VITE_API_KEY || null,
        openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY || null,
        ollamaBaseUrl: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434',
        ollamaModelName: import.meta.env.VITE_OLLAMA_MODEL_NAME || GENERATION_MODELS_CONFIG.ollama[0].id
    });
  }, []);

  const getCurrentGenerationModel = useCallback(() => {
    switch (llmProvider) {
      case 'gemini':
        return selectedGenerationModelByProvider.gemini;
      case 'openai':
        return selectedGenerationModelByProvider.openai;
      case 'ollama':
        return selectedGenerationModelByProvider.ollama || envConfigs.ollamaModelName;
      default:
        return '';
    }
  }, [llmProvider, selectedGenerationModelByProvider, envConfigs.ollamaModelName]);


  useEffect(() => {
    if (!workerBlobUrl) {
      if (appStatus !== AppStatus.ERROR) {
         setStatusMessage('Waiting for worker script...');
      }
      return;
    }

    if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
    }
    setAppStatus(AppStatus.INITIALIZING);
    const currentEmbeddingModelInfo = EMBEDDING_MODELS_INFO.find(m => m.name === embeddingModelName);
    const currentGenModel = getCurrentGenerationModel();
    setStatusMessage(`Initializing for ${llmProvider} with ${currentEmbeddingModelInfo?.displayName || embeddingModelName} (embeddings) and ${currentGenModel} (generation)...`);
    setGeneratedAnswer('');

    let currentConfigError: string | null = null;
    const activeGeminiKey = manualGeminiApiKey || envConfigs.geminiApiKey;
    const activeOpenAIKey = manualOpenAIApiKey || envConfigs.openAIApiKey;

    if (llmProvider === 'gemini' && !activeGeminiKey) {
      currentConfigError = "Gemini API Key not found. Please provide it via input or VITE_API_KEY env var.";
    } else if (llmProvider === 'openai' && !activeOpenAIKey) {
      currentConfigError = "OpenAI API Key not found. Please provide it via input or VITE_OPENAI_API_KEY env var.";
    } else if (llmProvider === 'ollama' && !envConfigs.ollamaBaseUrl) { 
      currentConfigError = "Ollama Base URL (VITE_OLLAMA_BASE_URL env var) not found.";
    }
    if (!currentGenModel) {
        currentConfigError = currentConfigError ? `${currentConfigError} Also, generation model not selected/specified.` : "Generation model not selected/specified.";
    }
    
    setConfigError(currentConfigError);

    if (currentConfigError) {
      setStatusMessage(currentConfigError);
      setAppStatus(AppStatus.ERROR);
      console.error(currentConfigError);
      return;
    }
    
    let worker: Worker;
    try {
        worker = new Worker(workerBlobUrl, { type: 'module' });
    } catch (e: any) {
        console.error("Failed to construct Worker from Blob URL:", e);
        const errorMsg = `Critical Error: Could not create worker from Blob URL. ${e.message || String(e)}`;
        setStatusMessage(errorMsg);
        setConfigError(errorMsg);
        setAppStatus(AppStatus.ERROR);
        return;
    }
    workerRef.current = worker;


    worker.postMessage({
      type: 'INIT_WORKER',
      payload: {
        transformersJsUrl: transformersJsUrl,
        apiKey: activeGeminiKey, 
        googleGenAiCdnUrl: googleGenAiCdnUrl,
        llmProvider: llmProvider,
        openAIApiKey: activeOpenAIKey,
        ollamaBaseUrl: envConfigs.ollamaBaseUrl,
        embeddingModelName: embeddingModelName,
        generationModelName: currentGenModel,
      }
    });

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { type, payload } = event.data;
      switch (type) {
        case 'PROGRESS':
          setStatusMessage(payload.message || 'Processing...');
          break;
        case 'WORKER_READY':
          setStatusMessage(payload.message || `Worker ready.`);
          setAppStatus(AppStatus.READY_FOR_DOCUMENT);
          setConfigError(null); 
          break;
        case 'DONE_PROCESSING':
          setStatusMessage('Document context updated. Ready to ask questions.');
          setAppStatus(AppStatus.DOCUMENT_PROCESSED);
          break;
        case 'CONTEXT_CLEARED':
          setStatusMessage('Document context cleared. Ready for new document.');
          setGeneratedAnswer('');
          setQueryText('');
          setAppStatus(AppStatus.READY_FOR_DOCUMENT);
          break;
        case 'ANSWER':
          setGeneratedAnswer(payload.answer || 'No answer content.');
          setStatusMessage('Answer received. Ready for new question.');
          setAppStatus(AppStatus.ANSWER_RECEIVED);
          break;
        case 'ERROR':
          const errorMsg = `Error: ${payload.message || 'Unknown worker error'}`;
          setStatusMessage(errorMsg);
          setAppStatus(AppStatus.ERROR);
          if (payload.message?.toLowerCase().includes('api key') || 
              payload.message?.toLowerCase().includes('url') || 
              payload.message?.toLowerCase().includes('missing') ||
              payload.message?.toLowerCase().includes('failed to fetch')
            ) {
            setConfigError(payload.message || 'Configuration or network error.');
          }
          console.error('Worker Error (onmessage):', payload.message);
          break;
        default:
          console.warn('Unknown message type from worker:', type);
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      console.error('Unhandled Worker Error Event (worker.onerror):', event);
      
      let detailedMessage = 'Critical worker error (onerror).';
      if (event.message) {
        detailedMessage = event.message;
      }
      
      let errorDetails = `Error: ${detailedMessage}`;
      if (event.filename) { 
        errorDetails += `\nFile: ${event.filename}`;
      }
      if (event.lineno) {
        errorDetails += `\nLine: ${event.lineno}`;
      }
      if (event.colno) {
        errorDetails += `\nCol: ${event.colno}`;
      }
      if (event.error) { 
        console.error('Nested error object from worker.onerror:', event.error);
        errorDetails += `\nCause: ${event.error.message || event.error}`;
        if (event.error.stack) {
            errorDetails += `\nStack: ${event.error.stack}`;
        }
      }
      
      console.error('Formatted Worker Error Details:', errorDetails);
      setStatusMessage(`Critical Worker Error: ${detailedMessage}`);
      setConfigError(`A critical error occurred in the background worker: ${detailedMessage}`); 
      setAppStatus(AppStatus.ERROR);
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [workerBlobUrl, llmProvider, embeddingModelName, envConfigs, manualGeminiApiKey, manualOpenAIApiKey, selectedGenerationModelByProvider, getCurrentGenerationModel]); 

  const handleLlmProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = event.target.value as LlmProvider;
    setLlmProvider(newProvider);
    if (newProvider === 'gemini') {
        setSelectedGenerationModelByProvider(prev => ({ ...prev, gemini: GENERATION_MODELS_CONFIG.gemini[0].id }));
    } else if (newProvider === 'openai') {
        setSelectedGenerationModelByProvider(prev => ({ ...prev, openai: GENERATION_MODELS_CONFIG.openai[0].id }));
    } else if (newProvider === 'ollama') {
        setSelectedGenerationModelByProvider(prev => ({ ...prev, ollama: GENERATION_MODELS_CONFIG.ollama[0].id }));
    }
  };

  const handleEmbeddingModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = event.target.value;
    if (newModel !== embeddingModelName) {
        setEmbeddingModelName(newModel);
        const changedEmbeddingModelInfo = EMBEDDING_MODELS_INFO.find(m => m.name === newModel);
        setStatusMessage(`Changing embedding model to ${changedEmbeddingModelInfo?.displayName || newModel}. Existing document context will be cleared by the worker.`);
        setGeneratedAnswer(''); 
    }
  };

  const handleGenerationModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelId = event.target.value;
    if (llmProvider === 'openai') {
      setSelectedGenerationModelByProvider(prev => ({ ...prev, openai: newModelId }));
    } else if (llmProvider === 'gemini') {
      setSelectedGenerationModelByProvider(prev => ({ ...prev, gemini: newModelId }));
    } else if (llmProvider === 'ollama') {
      setSelectedGenerationModelByProvider(prev => ({ ...prev, ollama: newModelId }));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleClearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processDocumentContent = (content: string) => {
    if (!workerRef.current || appStatus === AppStatus.INITIALIZING || !workerBlobUrl) {
      setStatusMessage('Worker not available or still initializing.');
      return;
    }
    if (configError) { 
      setStatusMessage(`Configuration error: ${configError}. Cannot process.`);
      setAppStatus(AppStatus.ERROR);
      return;
    }
    setAppStatus(AppStatus.PROCESSING_DOCUMENT);
    setStatusMessage('Starting document processing in worker...');
    setGeneratedAnswer('');
    workerRef.current.postMessage({ type: 'PROCESS_DOCUMENT', payload: { text: content } });
  };

  const parsePdf = async (file: File): Promise<string> => {
    setStatusMessage(`Parsing PDF: ${file.name}...`);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(' ');
      fullText += '\n'; 
    }
    return fullText;
  };

  const parseDocx = async (file: File): Promise<string> => {
    setStatusMessage(`Parsing Word document (docx): ${file.name}...`);
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const parsePlainText = async (file: File): Promise<string> => {
    setStatusMessage(`Reading plain text file: ${file.name}...`);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve(event.target?.result as string || '');
      };
      reader.onerror = (error) => {
        console.error(`Error reading plain text file ${file.name}:`, error);
        reject(`Error reading plain text file ${file.name}`);
      };
      reader.readAsText(file);
    });
  };

  const handleProcessDocument = useCallback(async () => {
    if (configError) {
      setStatusMessage(`Cannot process: ${configError}`);
      setAppStatus(AppStatus.ERROR);
      return;
    }
    if (!workerBlobUrl) {
      setStatusMessage('Worker script not loaded yet. Please wait.');
      return;
    }
    if (documentText.trim() === '' && selectedFiles.length === 0) {
      setStatusMessage('Please paste text or select files to process.');
      return;
    }

    setAppStatus(AppStatus.PROCESSING_DOCUMENT);
    setStatusMessage('Preparing document content...');
    setGeneratedAnswer(''); 

    let combinedText = '';
    if (selectedFiles.length > 0) {
      try {
        const fileContents: string[] = [];
        for (const file of selectedFiles) {
          setStatusMessage(`Reading ${file.name}...`);
          let content = '';
          if (file.type === 'application/pdf') {
            content = await parsePdf(file);
          } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
            content = await parseDocx(file);
          } else if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.js') || file.name.endsWith('.py')) {
            content = await parsePlainText(file);
          } else {
            console.warn(`Unsupported file type: ${file.name} (${file.type}). Skipping.`);
            setStatusMessage(`Unsupported file type: ${file.name}. Skipping.`);
            continue; 
          }
          fileContents.push(content);
        }
        combinedText = fileContents.join('\n\n---\n\n'); 
        setDocumentText(combinedText); 
        handleClearFiles(); 
      } catch (error: any) {
        console.error('Error reading files:', error);
        setStatusMessage(`Error reading files: ${error.message || String(error)}`);
        setAppStatus(AppStatus.ERROR);
        return;
      }
    } else if (documentText.trim() !== '') {
      combinedText = documentText;
    }

    if (combinedText.trim() === '') {
        setStatusMessage('No processable content found from inputs.');
        setAppStatus(AppStatus.READY_FOR_DOCUMENT);
        return;
    }

    processDocumentContent(combinedText);
  }, [documentText, selectedFiles, configError, workerBlobUrl, appStatus]);

  const handleAskQuestion = useCallback(() => {
    if (configError) {
      setStatusMessage(`Cannot ask question: ${configError}`);
      setAppStatus(AppStatus.ERROR);
      return;
    }
    if (!workerRef.current || appStatus === AppStatus.INITIALIZING || !workerBlobUrl) {
      setStatusMessage('Worker not available or still initializing.');
      return;
    }
    if (queryText.trim() === '') {
      setStatusMessage('Please enter a question.');
      return;
    }
    if (appStatus !== AppStatus.DOCUMENT_PROCESSED && appStatus !== AppStatus.ANSWER_RECEIVED) {
        setStatusMessage('Please process a document first, or wait for current processing to complete.');
        return;
    }

    setAppStatus(AppStatus.PROCESSING_QUERY);
    setStatusMessage('Sending query to worker...');
    workerRef.current.postMessage({ type: 'QUERY', payload: { query: queryText } });
  }, [queryText, configError, workerBlobUrl, appStatus, workerRef]);
  
  const isProcessing = 
    appStatus === AppStatus.INITIALIZING ||
    appStatus === AppStatus.PROCESSING_DOCUMENT ||
    appStatus === AppStatus.PROCESSING_QUERY;

  const handleClearContext = useCallback(() => {
    if (!workerRef.current || isProcessing || !workerBlobUrl) {
      setStatusMessage('Worker busy or not ready to clear context.');
      return;
    }
    setStatusMessage('Requesting context clearance...');
    workerRef.current.postMessage({ type: 'CLEAR_CONTEXT' });
  }, [workerRef, isProcessing, workerBlobUrl]);


  const canAskQuestion = appStatus === AppStatus.DOCUMENT_PROCESSED || appStatus === AppStatus.ANSWER_RECEIVED;

  const formatAnswer = (text: string): string => {
    if (!text) return '';
    let html = text
      .replace(/</g, "&lt;").replace(/>/g, "&gt;") 
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')       
      .replace(/\*(.*?)\*/g, '<em>$1</em>')                 
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-2 rounded text-sm overflow-x-auto"><code>$1</code></pre>') 
      .replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm">$1</code>')    
      .replace(/\n/g, '<br />');                          
    return html;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 p-4 md:p-8 flex flex-col items-center text-gray-200">
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500 mb-3">
          Client-Side RAG Chat
        </h1>
        <p className="text-slate-300 text-sm md:text-base">
          Interact with your documents securely. Processing and AI interactions happen in your browser.
        </p>
      </header>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="llmProvider" className="block text-sm font-medium text-slate-300 mb-1">LLM Provider:</label>
          <select
            id="llmProvider"
            value={llmProvider}
            onChange={handleLlmProviderChange}
            disabled={isProcessing}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm placeholder-gray-500"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </div>
        <div>
          <label htmlFor="embeddingModel" className="block text-sm font-medium text-slate-300 mb-1">Embedding Model:</label>
          <select
            id="embeddingModel"
            value={embeddingModelName}
            onChange={handleEmbeddingModelChange}
            disabled={isProcessing}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm placeholder-gray-500"
          >
            {EMBEDDING_MODELS_INFO.map((model) => (
              <option key={model.name} value={model.name} title={model.description}>
                {model.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

       <div className="w-full max-w-4xl mb-4">
        {llmProvider === 'gemini' && (
          <div>
            <label htmlFor="geminiGenModel" className="block text-sm font-medium text-slate-300 mb-1">Gemini Generation Model:</label>
            <select
              id="geminiGenModel"
              value={selectedGenerationModelByProvider.gemini}
              onChange={handleGenerationModelChange}
              disabled={isProcessing}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm"
            >
              {GENERATION_MODELS_CONFIG.gemini.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
        )}
        {llmProvider === 'openai' && (
          <div>
            <label htmlFor="openaiGenModel" className="block text-sm font-medium text-slate-300 mb-1">OpenAI Generation Model:</label>
            <select
              id="openaiGenModel"
              value={selectedGenerationModelByProvider.openai}
              onChange={handleGenerationModelChange}
              disabled={isProcessing}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm"
            >
              {GENERATION_MODELS_CONFIG.openai.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
        )}
        {llmProvider === 'ollama' && (
          <div className="p-3 bg-slate-800 rounded-lg">
            <label htmlFor="ollamaGenModel" className="block text-sm font-medium text-slate-300 mb-1">Ollama Generation Model:</label>
             <select
              id="ollamaGenModel"
              value={selectedGenerationModelByProvider.ollama}
              onChange={handleGenerationModelChange}
              disabled={isProcessing}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm"
            >
              {GENERATION_MODELS_CONFIG.ollama.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-400">
              Ensure Ollama is running and the selected model (e.g., `{selectedGenerationModelByProvider.ollama}`) is pulled.
              Default Ollama URL: `{envConfigs.ollamaBaseUrl}`. Configure via `VITE_OLLAMA_BASE_URL` environment variable if needed.
            </p>
          </div>
        )}
      </div>


      {llmProvider === 'gemini' && (
        <div className="w-full max-w-4xl mb-4 p-3 bg-slate-800 rounded-lg">
          <label htmlFor="geminiApiKey" className="block text-sm font-medium text-slate-300 mb-1">Gemini API Key (Optional - uses env var VITE_API_KEY if blank):</label>
          <input
            type="password"
            id="geminiApiKey"
            value={manualGeminiApiKey}
            onChange={(e) => setManualGeminiApiKey(e.target.value)}
            disabled={isProcessing}
            placeholder="Enter Gemini API Key"
            className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-gray-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm placeholder-gray-500"
          />
        </div>
      )}
      {llmProvider === 'openai' && (
         <div className="w-full max-w-4xl mb-4 p-3 bg-slate-800 rounded-lg">
          <label htmlFor="openAIApiKey" className="block text-sm font-medium text-slate-300 mb-1">OpenAI API Key (Optional - uses env var VITE_OPENAI_API_KEY if blank):</label>
          <input
            type="password"
            id="openAIApiKey"
            value={manualOpenAIApiKey}
            onChange={(e) => setManualOpenAIApiKey(e.target.value)}
            disabled={isProcessing}
            placeholder="Enter OpenAI API Key"
            className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-gray-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm placeholder-gray-500"
          />
        </div>
      )}
      { (llmProvider === 'gemini' || llmProvider === 'openai') && (
        <p className="w-full max-w-4xl text-xs text-slate-400 mb-4 text-center">
            Note: API keys entered here are used in your browser and not stored persistently by this app, but be mindful of browser extensions or other local factors. Using environment variables (prefixed with VITE_ and set during build or in a .env file) is generally more secure for keys.
        </p>
      )}


      <main className="w-full max-w-4xl space-y-6">
        <StepCard stepNumber={1} title="Provide Your Document(s)">
          <textarea
            rows={8}
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            placeholder="Paste your document text here..."
            disabled={isProcessing || !workerBlobUrl}
            className="w-full p-3 border border-gray-600 bg-slate-700 text-slate-200 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 placeholder-gray-500"
          />
          <div className="my-3 text-center text-sm text-slate-400 font-semibold">OR UPLOAD FILES</div>
          <div className="flex flex-col items-center space-y-3">
            <input 
              type="file" 
              multiple 
              ref={fileInputRef}
              onChange={handleFileChange} 
              disabled={isProcessing || !workerBlobUrl}
              className="hidden" 
              id="fileUpload"
              accept=".txt,.md,.json,.csv,.js,.py,.pdf,.docx"
            />
            <label 
              htmlFor="fileUpload"
              className={`w-full md:w-auto px-6 py-3 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors
                ${isProcessing || !workerBlobUrl ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer'}`}
            >
              Select Files (.txt, .md, .pdf, .docx, etc.)
            </label>
            {selectedFiles.length > 0 && (
              <div className="w-full text-sm text-slate-300">
                <p className="font-semibold mb-1">Selected files:</p>
                <ul className="list-disc list-inside max-h-24 overflow-y-auto bg-slate-700 p-2 rounded">
                  {selectedFiles.map(file => <li key={file.name}>{file.name}</li>)}
                </ul>
                <button 
                  onClick={handleClearFiles}
                  className="mt-2 text-xs text-sky-400 hover:text-sky-300"
                  disabled={isProcessing}
                >
                  Clear selected files
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleProcessDocument}
            disabled={isProcessing || (!documentText.trim() && selectedFiles.length === 0) || !!configError || !workerBlobUrl}
            className={`mt-6 w-full px-6 py-3 text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors
              ${isProcessing || (!documentText.trim() && selectedFiles.length === 0) || !!configError || !workerBlobUrl ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {isProcessing && appStatus === AppStatus.PROCESSING_DOCUMENT ? 'Processing...' : 'Process Document(s)'}
          </button>
        </StepCard>

        <StepCard stepNumber={2} title="Ask a Question" isDimmed={!canAskQuestion && appStatus !== AppStatus.ERROR && !configError}>
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Ask a question about your document..."
            disabled={isProcessing || !canAskQuestion || !!configError || !workerBlobUrl}
            className="w-full p-3 border border-gray-600 bg-slate-700 text-slate-200 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 placeholder-gray-500"
          />
          <button
            onClick={handleAskQuestion}
            disabled={isProcessing || !canAskQuestion || queryText.trim() === '' || !!configError || !workerBlobUrl}
            className={`mt-4 w-full px-6 py-3 text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors
              ${isProcessing || !canAskQuestion || queryText.trim() === '' || !!configError || !workerBlobUrl ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {isProcessing && appStatus === AppStatus.PROCESSING_QUERY ? 'Asking...' : 'Ask'}
          </button>
        </StepCard>

        <StepCard stepNumber={3} title="Status & Answer">
            <div className="flex items-center mb-3 p-3 bg-slate-800 rounded-md">
                <StatusIndicator status={appStatus} />
                <p className="ml-3 text-sm text-slate-300 flex-1">{statusMessage}</p>
            </div>
            {configError && appStatus === AppStatus.ERROR && (
                 <div className="mb-4 p-3 text-sm text-red-300 bg-red-900 border border-red-700 rounded-md">
                    <strong>Configuration Problem:</strong> {configError}
                </div>
            )}
            {generatedAnswer && (
            <div className="mt-4 p-4 bg-slate-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-sky-400 mb-2">Answer:</h3>
              <div 
                className="prose-custom text-slate-300 leading-relaxed" 
                dangerouslySetInnerHTML={{ __html: formatAnswer(generatedAnswer) }} 
              />
            </div>
          )}
        </StepCard>
      </main>

      <footer className="w-full max-w-4xl mt-8 pt-6 border-t border-slate-700 text-center">
        <button
            onClick={handleClearContext}
            disabled={isProcessing || !workerBlobUrl}
            className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-red-500 transition-colors
                ${isProcessing || !workerBlobUrl ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-red-700 hover:bg-red-800 text-slate-200'}`}
        >
            Clear Stored Document Context
        </button>
        <p className="text-xs text-slate-500 mt-4">
          Client-Side RAG Demo. Privacy-focused processing.
        </p>
      </footer>
    </div>
  );
};

export default App;
