import React, { useState } from 'react';
import { Icon } from '@/components/primitives';
import { iconComponentMap } from '@/components/primitives/Icon/iconMapping';
import { IconName } from '@/components/primitives/Icon/types';

export const IconGallery: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const iconEntries = Object.keys(iconComponentMap) as IconName[];

  const filteredIcons = iconEntries.filter(iconName =>
    iconName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 border border-default rounded-lg bg-surface-0 text-main"
        />
        <span className="text-sm text-subtle">
          {filteredIcons.length} / {iconEntries.length} icons
        </span>
      </div>

      <div className="grid grid-cols-6 gap-4 p-4 bg-surface-0 rounded-lg border border-default max-h-[400px] overflow-y-auto">
        {filteredIcons.map((iconName) => (
          <div
            key={iconName}
            className="flex flex-col items-center gap-2 p-3 hover:bg-surface-1 rounded-lg cursor-pointer transition-colors"
            title={iconName}
          >
            <Icon name={iconName} size="xl" />
            <span className="text-xs text-subtle text-center leading-tight max-w-full truncate">
              {iconName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
