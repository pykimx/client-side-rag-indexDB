/*
  file name: components/StepCard.tsx
  file description: Reusable React component that renders a card with a step number and title, used to visually structure different stages of the application workflow.
  author: Google Gemini, AI Assistant
  date created: 2024-06-07
  version number: 1.0
  AI WARNING: This file is generated with AI assistance. Please review and verify the content before use.
*/
import React from 'react';

interface StepCardProps {
  stepNumber: number;
  title: string;
  isDimmed?: boolean;
  children: React.ReactNode;
}

const StepCard: React.FC<StepCardProps> = ({ stepNumber, title, isDimmed = false, children }) => {
  return (
    <section 
      className={`bg-white p-6 rounded-xl shadow-lg transition-all duration-300 ease-in-out ${isDimmed ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
    >
      <div className="flex items-center mb-4">
        <div 
          className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 text-sm"
        >
          {stepNumber}
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </section>
  );
};

export default StepCard;