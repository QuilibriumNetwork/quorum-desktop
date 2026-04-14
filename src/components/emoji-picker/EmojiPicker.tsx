// src/components/emoji-picker/EmojiPicker.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import type { ListRange } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import { Button } from '../primitives';
import ListSearchInput from '../ui/ListSearchInput';
import EmojiSprite from './EmojiSprite';
import {
  buildRowData,
  buildSearchRows,
  unifiedToEmoji,
  getEmojiImageUrl,
} from './emojiData';
import { useSkinTone, SKIN_TONES } from './useSkinTone';
import { useFrequentlyUsed } from './useFrequentlyUsed';
import type { CustomEmoji, EmojiData, EmojiItem, VirtualRow } from './types';
import { CATEGORY_ICONS } from './types';
import './EmojiPicker.scss';

interface EmojiPickerProps {
  onEmojiClick: (emoji: EmojiData) => void;
  customEmojis?: CustomEmoji[];
  width?: number | string;
  height?: number | string;
}

const DEFAULT_COLUMNS = 8;
const CELL_SIZE = 36; // px, matches $s-9 (2.25rem)
const H_PADDING = 16; // px, $s-2 * 2 sides

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiClick,
  customEmojis = [],
  width = 300,
  height = 400,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Frequently Used');
  const [columnsCount, setColumnsCount] = useState(DEFAULT_COLUMNS);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { skinTone, setSkinTone } = useSkinTone();
  const { frequentUnifieds, recordUsage } = useFrequentlyUsed();

  // Measure container width to compute column count
  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      const w = containerRef.current?.clientWidth ?? 300;
      setColumnsCount(Math.max(1, Math.floor((w - H_PADDING) / CELL_SIZE)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build row data
  const { rows, categoryRowIndices } = useMemo(
    () => buildRowData(columnsCount, frequentUnifieds, customEmojis),
    [columnsCount, frequentUnifieds, customEmojis]
  );

  // Search results as rows
  const searchRows = useMemo(() => {
    if (!debouncedQuery) return null;
    return buildSearchRows(debouncedQuery, columnsCount, customEmojis);
  }, [debouncedQuery, columnsCount, customEmojis]);

  const displayRows = searchRows ?? rows;
  const isSearching = searchRows != null;

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedQuery(value), 150);
  }, []);

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  // Handle emoji click
  const handleEmojiClick = useCallback(
    (item: EmojiItem) => {
      let unified = item.unified;
      if (skinTone && item.hasSkinVariations && item.skinVariations?.[skinTone]) {
        unified = item.skinVariations[skinTone].unified;
      }

      recordUsage(item.unified);
      onEmojiClick({
        emoji: unifiedToEmoji(unified),
        unified: unified.toLowerCase(),
        names: item.shortNames,
        imageUrl: getEmojiImageUrl(unified),
        isCustom: false,
      });
    },
    [skinTone, onEmojiClick, recordUsage]
  );

  // Handle custom emoji click
  const handleCustomEmojiClick = useCallback(
    (ce: CustomEmoji) => {
      onEmojiClick({
        emoji: ce.names[0] ?? ce.id,
        unified: `custom-${ce.id}`,
        names: ce.names,
        imageUrl: ce.imgUrl,
        isCustom: true,
      });
    },
    [onEmojiClick]
  );

  // Active category tracking via rangeChanged
  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      if (isSearching) return;
      for (let i = range.startIndex; i >= 0; i--) {
        const row = rows[i];
        if (row?.type === 'header') {
          setActiveCategory(row.category);
          return;
        }
      }
    },
    [rows, isSearching]
  );

  // Scroll to category on tab click
  const handleCategoryClick = useCallback(
    (category: string) => {
      const index = categoryRowIndices.get(category);
      if (index != null && virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({ index, align: 'start' });
        setActiveCategory(category);
      }
    },
    [categoryRowIndices]
  );

  // Available categories for tab bar
  const availableCategories = useMemo(
    () => Array.from(categoryRowIndices.keys()),
    [categoryRowIndices]
  );

  // Render a row
  const renderRow = useCallback(
    (_index: number, row: VirtualRow) => {
      if (row.type === 'header') {
        return <div className="emoji-picker__row-header">{row.label}</div>;
      }

      if (row.type === 'custom-row') {
        return (
          <div className="emoji-picker__emoji-row">
            {row.emojis.map((ce) => (
              <Button
                key={ce.id}
                type="unstyled"
                className="emoji-picker__emoji-btn"
                onClick={() => handleCustomEmojiClick(ce)}
                title={ce.names[0]}
              >
                <img src={ce.imgUrl} alt={ce.names[0]} className="emoji-picker__custom-emoji-img" />
              </Button>
            ))}
          </div>
        );
      }

      // emoji-row
      return (
        <div className="emoji-picker__emoji-row">
          {row.emojis.map((item) => {
            let sheetX = item.sheetX;
            let sheetY = item.sheetY;
            if (skinTone && item.hasSkinVariations && item.skinVariations?.[skinTone]) {
              const variant = item.skinVariations[skinTone];
              sheetX = variant.sheetX;
              sheetY = variant.sheetY;
            }

            return (
              <Button
                key={item.unified}
                type="unstyled"
                className="emoji-picker__emoji-btn"
                onClick={() => handleEmojiClick(item)}
                title={item.shortName}
              >
                <EmojiSprite sheetX={sheetX} sheetY={sheetY} label={item.shortName} />
              </Button>
            );
          })}
        </div>
      );
    },
    [skinTone, handleEmojiClick, handleCustomEmojiClick]
  );

  return (
    <div className="emoji-picker" style={{ width, height }} ref={containerRef}>
      {/* Search */}
      <div className="emoji-picker__search">
        <ListSearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t`Search emoji...`}
          variant="bordered"
        />
      </div>

      {/* Header: category tabs + skin tone dots */}
      {!isSearching && (
        <div className="emoji-picker__header">
          {availableCategories.map((cat) => (
            <Button
              key={cat}
              type="unstyled"
              className={`emoji-picker__category-btn${activeCategory === cat ? ' emoji-picker__category-btn--active' : ''}`}
              onClick={() => handleCategoryClick(cat)}
              title={cat}
            >
              {CATEGORY_ICONS[cat] ? (
                <EmojiSprite
                  sheetX={CATEGORY_ICONS[cat].sheetX}
                  sheetY={CATEGORY_ICONS[cat].sheetY}
                  size={18}
                />
              ) : (
                <span style={{ fontSize: '1.125rem' }}>📁</span>
              )}
            </Button>
          ))}

          {/* Skin tone selector */}
          <div className="emoji-picker__skin-tones">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone ?? 'default'}
                className={`emoji-picker__skin-tone-dot${skinTone === tone ? ' emoji-picker__skin-tone-dot--active' : ''}`}
                onClick={() => setSkinTone(tone)}
                type="button"
                style={{
                  backgroundColor: tone === null ? '#ffcc4d'
                    : tone === '1F3FB' ? '#f7dece'
                    : tone === '1F3FC' ? '#e0bb95'
                    : tone === '1F3FD' ? '#bf8f68'
                    : tone === '1F3FE' ? '#9b643d'
                    : '#594539',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Emoji grid */}
      <div className="emoji-picker__grid-container">
        {displayRows.length === 0 && isSearching ? (
          <div className="emoji-picker__no-results">{t`No emoji found`}</div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            totalCount={displayRows.length}
            overscan={200}
            itemContent={(index) => {
              const row = displayRows[index];
              if (!row) return null;
              return renderRow(index, row);
            }}
            rangeChanged={handleRangeChanged}
          />
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;
