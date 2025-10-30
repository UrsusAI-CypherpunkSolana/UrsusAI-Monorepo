import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, steps }) => {
  return (
    <div className="flex items-center justify-center mb-12">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isCompleted = currentStep > stepNumber;
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#10b981] text-white shadow-lg shadow-[#10b981]/25'
                    : isActive
                    ? 'bg-[#d8e9ea] text-black shadow-lg shadow-[#d8e9ea]/25'
                    : 'bg-[#2a2a2a] text-[#a0a0a0] border border-[#3a3a3a]'
                }`}
              >
                {isCompleted ? (
                  <Check size={18} className="animate-in fade-in duration-300" />
                ) : (
                  stepNumber
                )}
              </div>
              
              {/* Step Label */}
              <div className="mt-3 text-center max-w-[120px]">
                <div
                  className={`text-sm font-medium transition-colors ${
                    isActive || isCompleted ? 'text-white' : 'text-[#a0a0a0]'
                  }`}
                >
                  {step}
                </div>
              </div>
            </div>

            {/* Connector Line */}
            {!isLast && (
              <div
                className={`w-20 h-0.5 mx-4 mt-[-24px] transition-colors duration-300 ${
                  currentStep > stepNumber ? 'bg-[#10b981]' : 'bg-[#2a2a2a]'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;