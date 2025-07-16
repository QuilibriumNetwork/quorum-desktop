import React, { useState, useRef, useEffect } from 'react';
import SpaceTag from './SpaceTag';
import { t } from '@lingui/core/macro';

interface SpaceOption {
  spaceId: string;
  spaceName: string;
}

interface SpaceTagSelectorProps {
  value: string | undefined;
  onChange: (spaceId: string) => void;
  options: SpaceOption[];
  placeholder?: string;
}

const SpaceTagSelector: React.FunctionComponent<SpaceTagSelectorProps> = ({
  value,
  onChange,
  options,
  placeholder = t`Select a space tag`
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.spaceId === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (spaceId: string) => {
    onChange(spaceId);
    setIsOpen(false);
  };

  return (
    <div className="relative min-w-[400px]" ref={dropdownRef}>
      <div
        className="quorum-input cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {selectedOption ? (
            <>
              <span>{selectedOption.spaceName}</span>
              <SpaceTag spaceId={selectedOption.spaceId} size="small" />
            </>
          ) : (
            <span className="text-text-subtle">{placeholder}</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-surface-3 border border-surface-6 rounded-md shadow-lg max-h-60 overflow-auto">
          <div
            className="px-3 py-2 hover:bg-surface-4 cursor-pointer text-text-subtle"
            onClick={() => handleSelect('')}
          >
            {placeholder}
          </div>
          {options.map((option) => (
            <div
              key={option.spaceId}
              className="px-3 py-2 hover:bg-surface-4 cursor-pointer flex items-center gap-2"
              onClick={() => handleSelect(option.spaceId)}
            >
              <span>{option.spaceName}</span>
              <SpaceTag spaceId={option.spaceId} size="small" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SpaceTagSelector;