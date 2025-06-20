/*
  file name: components/StatusIndicator.tsx
  file description: React component to display a visual status indicator (colored dot with optional pulse animation) based on the application's current state.
  author: Google Gemini, AI Assistant
  date created: 2024-06-07
  version number: 1.0
  AI WARNING: This file is generated with AI assistance. Please review and verify the content before use.
*/
import React from 'react';
import { AppStatus } from '../types';

interface StatusIndicatorProps {
  status: AppStatus;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  let bgColor = 'bg-gray-400'; // Default
  let pulse = false;

  switch (status) {
    case AppStatus.INITIALIZING:
    case AppStatus.PROCESSING_DOCUMENT:
    case AppStatus.PROCESSING_QUERY:
      bgColor = 'bg-blue-500'; // Processing
      pulse = true;
      break;
    case AppStatus.READY_FOR_DOCUMENT:
    case AppStatus.DOCUMENT_PROCESSED:
    case AppStatus.ANSWER_RECEIVED:
      bgColor = 'bg-green-500'; // Ready/Success
      break;
    case AppStatus.ERROR:
      bgColor = 'bg-red-500'; // Error
      break;
  }

  return (
    <div className={`w-3 h-3 rounded-full ${bgColor} ${pulse ? 'animate-pulse' : ''}`}></div>
  );
};

export default StatusIndicator;