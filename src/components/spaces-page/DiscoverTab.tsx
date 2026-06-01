import * as React from 'react';
import { t } from '@lingui/core/macro';
import { useExploreSpaces, SPACE_CATEGORIES } from '../../hooks/business/spaces';
import { useSpaceJoining } from '../../hooks/business/spaces/useSpaceJoining';
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
  } = useExploreSpaces();
  const { joinSpace, joining } = useSpaceJoining();
  const [joiningEntry, setJoiningEntry] = React.useState<string | null>(null);

  const categoryOptions = React.useMemo(
    () =>
      SPACE_CATEGORIES.map((c) => ({
        label: c.value === null ? t`All categories` : c.label,
        value: c.value ?? 'all',
      })),
    []
  );

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
