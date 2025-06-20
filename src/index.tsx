/*
  file name: src/index.tsx
  file description: Main entry point for the React application. Renders the App component into the DOM.
  author: Google Gemini, AI Assistant
  date created: 2024-06-07
  version number: 1.0
  AI WARNING: This file is generated with AI assistance. Please review and verify the content before use.
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Adjusted path if App.tsx is in the same src directory

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
