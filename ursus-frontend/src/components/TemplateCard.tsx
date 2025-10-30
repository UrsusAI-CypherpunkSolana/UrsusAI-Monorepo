import React from 'react';
import { Zap } from 'lucide-react';

interface TemplateCardProps {
  title: string;
  description: string;
  icon: string;
  onSelect: (template: string) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ title, description, icon, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(description)}
      className="group w-full p-6 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl hover:border-[#d8e9ea] transition-all duration-300 text-left hover:shadow-lg hover:shadow-[#d8e9ea]/10 relative overflow-hidden"
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#d8e9ea]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        {/* Icon */}
        <div className="w-12 h-12 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
          <span className="text-xl">{icon}</span>
        </div>
        
        {/* Content */}
        <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-[#d8e9ea] transition-colors">
          {title}
        </h3>
        <p className="text-[#a0a0a0] text-sm leading-relaxed group-hover:text-[#e5e5e5] transition-colors">
          {description}
        </p>
        
        {/* Use Template Indicator */}
        <div className="flex items-center gap-2 mt-4 text-[#d8e9ea] opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          <Zap size={14} />
          <span className="text-sm font-medium">Use Template</span>
        </div>
      </div>
    </button>
  );
};

export default TemplateCard;