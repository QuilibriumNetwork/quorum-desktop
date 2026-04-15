// src/components/emoji-picker/EmojiPicker.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import type { ListRange } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import ListSearchInput from '../ui/ListSearchInput';
import EmojiSprite from './EmojiSprite';
import {
  buildRowData,
  buildSearchRows,
  unifiedToEmoji,
  getEmojiImageUrl,
  getRockHandSprite,
} from './emojiData';
import { useSkinTone, SKIN_TONES } from './useSkinTone';
import { useFrequentlyUsed } from './useFrequentlyUsed';
import type { CustomEmoji, EmojiData, EmojiItem } from './types';
import { CATEGORY_ICONS } from './types';
import './EmojiPicker.scss';

interface EmojiPickerProps {
  onEmojiClick: (emoji: EmojiData) => void;
  customEmojis?: CustomEmoji[];
}

const DEFAULT_COLUMNS = 8;
const CELL_MIN_SIZE = 36;  // px — minimum cell size; JS picks how many cols fit
const CELL_GAP = 4;        // px — gap between cells, matches $s-1 in CSS
const H_PADDING = 16;      // px — row horizontal padding ($s-2 × 2)

const SKIN_TONE_LABELS: Record<string, string> = {
  default: 'Default skin tone',
  '1F3FB': 'Light skin tone',
  '1F3FC': 'Medium-light skin tone',
  '1F3FD': 'Medium skin tone',
  '1F3FE': 'Medium-dark skin tone',
  '1F3FF': 'Dark skin tone',
};


const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiClick,
  customEmojis = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [columnsCount, setColumnsCount] = useState(DEFAULT_COLUMNS);
  const [skinPopoverOpen, setSkinPopoverOpen] = useState(false);
  const skinTriggerRef = useRef<HTMLDivElement>(null);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Suppress rangeChanged updates briefly after a manual category scroll
  // to prevent Virtuoso's async scroll event from overwriting the clicked category.
  const ignoreRangeChangedUntilRef = useRef<number>(0);

  const { skinTone, setSkinTone } = useSkinTone();
  const { frequentUnifieds, recordUsage } = useFrequentlyUsed();

  // Measure the grid container directly to compute column count.
  // Observing the grid element itself avoids manual subtraction of sidebar/scrollbar/padding widths
  // and works correctly regardless of how the picker is sized by its parent (popover vs drawer).
  useEffect(() => {
    if (!gridRef.current) return;
    const measure = () => {
      const w = gridRef.current?.clientWidth ?? 300;
      const cols = Math.max(1, Math.floor((w - H_PADDING + CELL_GAP) / (CELL_MIN_SIZE + CELL_GAP)));
      setColumnsCount(cols);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, []);

  // Build row data
  const { rows, categoryRowIndices } = useMemo(
    () => buildRowData(columnsCount, frequentUnifieds, customEmojis),
    [columnsCount, frequentUnifieds, customEmojis]
  );

  // Sync active category — ensure it always points to a real category
  useEffect(() => {
    if (!categoryRowIndices.has(activeCategory)) {
      const first = categoryRowIndices.keys().next().value;
      if (first !== undefined) setActiveCategory(first);
    }
  }, [categoryRowIndices, activeCategory]);

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

  useEffect(() => {
    if (!skinPopoverOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (skinTriggerRef.current && !skinTriggerRef.current.contains(e.target as Node)) {
        setSkinPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [skinPopoverOpen]);

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

  // Active category tracking via rangeChanged.
  // Finds the nearest header at or before startIndex using categoryRowIndices (O(n) over categories, not rows).
  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      if (isSearching) return;
      if (Date.now() < ignoreRangeChangedUntilRef.current) return; // suppressed after manual scroll
      let best: string | undefined;
      let bestIndex = -1;
      for (const [category, idx] of categoryRowIndices) {
        if (idx <= range.startIndex && idx > bestIndex) {
          bestIndex = idx;
          best = category;
        }
      }
      if (best !== undefined) setActiveCategory(best);
    },
    [categoryRowIndices, isSearching]
  );

  // Scroll to category on tab click
  const handleCategoryClick = useCallback(
    (category: string) => {
      const index = categoryRowIndices.get(category);
      if (index != null && virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({ index, align: 'start' });
        setActiveCategory(category);
        // Suppress rangeChanged for 400ms to let Virtuoso settle
        ignoreRangeChangedUntilRef.current = Date.now() + 400;
      }
    },
    [categoryRowIndices]
  );

  // Available categories for tab bar
  const availableCategories = useMemo(
    () => Array.from(categoryRowIndices.keys()),
    [categoryRowIndices]
  );

  // Render a row — passed directly to Virtuoso itemContent for stable reference
  const renderRow = useCallback(
    (index: number) => {
      const row = displayRows[index];
      if (!row) return null;

      if (row.type === 'header') {
        return <div className="emoji-picker__row-header">{row.label}</div>;
      }

      if (row.type === 'custom-row') {
        return (
          <div className="emoji-picker__emoji-row">
            {row.emojis.map((ce) => (
              <button
                key={ce.id}
                type="button"
                className="emoji-picker__emoji-btn"
                onClick={() => handleCustomEmojiClick(ce)}
                aria-label={ce.names[0]}
              >
                <img src={ce.imgUrl} alt={ce.names[0]} className="emoji-picker__custom-emoji-img" />
              </button>
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
              <button
                key={item.unified}
                type="button"
                className="emoji-picker__emoji-btn"
                onClick={() => handleEmojiClick(item)}
                aria-label={item.shortName}
              >
                <EmojiSprite sheetX={sheetX} sheetY={sheetY} label={item.shortName} />
              </button>
            );
          })}
        </div>
      );
    },
    [displayRows, skinTone, handleEmojiClick, handleCustomEmojiClick]
  );

  return (
    <div className="emoji-picker" ref={containerRef} style={{ '--emoji-cols': columnsCount } as React.CSSProperties}>
      {/* Top bar: search + skin tone */}
      <div className="emoji-picker__topbar">
        <div className="emoji-picker__search-wrap">
          <ListSearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={t`Search emoji...`}
            variant="bordered"
          />
        </div>

        {/* Skin tone trigger */}
        <div className="emoji-picker__skin-trigger" ref={skinTriggerRef}>
          <div
            className={`emoji-picker__skin-rock${skinPopoverOpen ? ' emoji-picker__skin-rock--open' : ''}`}
            onClick={() => setSkinPopoverOpen((v) => !v)}
            role="button"
            tabIndex={0}
            aria-label={t`Select skin tone`}
            aria-expanded={skinPopoverOpen}
          >
            <EmojiSprite
              {...getRockHandSprite(skinTone)}
              size={24}
              label={SKIN_TONE_LABELS[skinTone ?? 'default']}
            />
          </div>

          {skinPopoverOpen && (
            <div className="emoji-picker__skin-popover">
              {SKIN_TONES.map((tone) => (
                <div
                  key={tone ?? 'default'}
                  className={`emoji-picker__skin-rock${skinTone === tone ? ' emoji-picker__skin-rock--active' : ''}`}
                  onClick={() => { setSkinTone(tone); setSkinPopoverOpen(false); }}
                  role="button"
                  tabIndex={0}
                  aria-label={SKIN_TONE_LABELS[tone ?? 'default']}
                >
                  <EmojiSprite
                    {...getRockHandSprite(tone)}
                    size={24}
                    label={SKIN_TONE_LABELS[tone ?? 'default']}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body: sidebar + grid */}
      <div className="emoji-picker__body">
        {/* Left sidebar — always visible; buttons disabled during search */}
        <div className="emoji-picker__sidebar">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`emoji-picker__category-btn${activeCategory === cat && !isSearching ? ' emoji-picker__category-btn--active' : ''}`}
              onClick={() => { if (!isSearching) handleCategoryClick(cat); }}
              disabled={isSearching}
              aria-label={cat}
            >
              {CATEGORY_ICONS[cat] ? (
                <EmojiSprite
                  sheetX={CATEGORY_ICONS[cat].sheetX}
                  sheetY={CATEGORY_ICONS[cat].sheetY}
                  size={18}
                />
              ) : (
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>●</span>
              )}
            </button>
          ))}
        </div>

        {/* Grid + preview (column) — sidebar does not extend behind preview */}
        <div className="emoji-picker__grid-col">
          <div className="emoji-picker__grid-container" ref={gridRef}>
            {displayRows.length === 0 && isSearching ? (
              <div className="emoji-picker__no-results">{t`No emoji found`}</div>
            ) : (
              <Virtuoso
                ref={virtuosoRef}
                totalCount={displayRows.length}
                overscan={200}
                itemContent={renderRow}
                rangeChanged={handleRangeChanged}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;
