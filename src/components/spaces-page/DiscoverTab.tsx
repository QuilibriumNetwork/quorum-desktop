import * as React from 'react';
import { t } from '@lingui/core/macro';
import { useExploreSpaces, SPACE_CATEGORIES } from '../../hooks/business/spaces';
import { useSpaceJoining } from '../../hooks/business/spaces/useSpaceJoining';
import { useSpaces } from '../../hooks/queries/spaces/useSpaces';
import { Input, Select, Button, Icon, Callout } from '../primitives';
import { SpaceCard } from './SpaceCard';
import type { SpaceCategory } from '@quilibrium/quorum-shared';
import './DiscoverTab.scss';

export const DiscoverTab: React.FC = () => {
  const {
    entries,
    total,
    hasMore,
    isLoading,
    error,
    search,
    setSearch,
    category,
    setCategory,
    loadMore,
    refetch,
    categoryCounts,
  } = useExploreSpaces();
  const { joinSpace, joining } = useSpaceJoining();
  const [joiningEntry, setJoiningEntry] = React.useState<string | null>(null);

  const { data: joinedSpaces } = useSpaces({});
  const joinedIds = React.useMemo(
    () => new Set((joinedSpaces ?? []).map((s) => s.spaceId)),
    [joinedSpaces]
  );

  const categoryOptions = React.useMemo(() => {
    const allCount = categoryCounts
      ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
      : null;
    return SPACE_CATEGORIES.map((c) => {
      const baseLabel = c.value === null ? t`All categories` : c.label;
      const count = c.value === null ? allCount : categoryCounts?.[c.value];
      return {
        label: count !== null && count !== undefined ? `${baseLabel} (${count})` : baseLabel,
        value: c.value ?? 'all',
      };
    });
  }, [categoryCounts]);

  const handleCategoryChange = (value: string | string[]) => {
    const v = value as string;
    setCategory(v === 'all' ? null : (v as SpaceCategory));
  };

  const handleJoin = async (inviteLink: string, spaceAddress: string) => {
    setJoiningEntry(spaceAddress);
    try {
      await joinSpace(inviteLink);
    } finally {
      setJoiningEntry(null);
    }
  };

  return (
    <div className="discover-tab">
      <div className="discover-tab__header">
        <Input
          className="discover-tab__search"
          value={search}
          onChange={setSearch}
          placeholder={t`Search public spaces...`}
          variant="bordered"
        />
        <Select
          value={category ?? 'all'}
          onChange={handleCategoryChange}
          options={categoryOptions}
          size="medium"
          variant="bordered"
        />
      </div>

      {error && (
        <Callout variant="error" size="sm">
          <div className="flex items-center justify-between gap-2">
            <span>{t`Failed to load public spaces.`}</span>
            <Button type="secondary" onClick={() => refetch()}>
              {t`Retry`}
            </Button>
          </div>
        </Callout>
      )}

      <div className="discover-tab__grid">
        {isLoading && entries.length === 0 ? (
          <div className="discover-tab__loading">
            <Icon name="spinner" className="icon-spin" />
            <span>{t`Loading public spaces...`}</span>
          </div>
        ) : entries.length === 0 && !error ? (
          <div className="discover-tab__empty">
            {search.trim() || category
              ? t`No public spaces match the current filters.`
              : t`No public spaces available yet.`}
          </div>
        ) : (
          entries.map((entry) => (
            <SpaceCard
              key={entry.space_address}
              variant="public"
              iconUrl={entry.icon || undefined}
              spaceAddress={entry.space_address}
              spaceName={entry.name}
              memberCount={entry.member_count ?? 0}
              category={entry.category}
              description={entry.description}
              isJoining={joiningEntry === entry.space_address && joining}
              alreadyJoined={joinedIds.has(entry.space_address)}
              onJoin={() => handleJoin(entry.invite_link, entry.space_address)}
            />
          ))
        )}
      </div>

      {hasMore && !isLoading && entries.length > 0 && (
        <div className="discover-tab__load-more">
          <Button type="secondary" onClick={loadMore}>
            {t`Load more`}
          </Button>
        </div>
      )}

      {total > 0 && entries.length > 0 && (
        <div className="discover-tab__footer">
          {t`Showing ${entries.length} of ${total} spaces`}
        </div>
      )}
    </div>
  );
};
