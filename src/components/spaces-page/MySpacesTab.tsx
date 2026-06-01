import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { Space } from '@quilibrium/quorum-shared';
import { useSpaces } from '../../hooks/queries/spaces/useSpaces';
import { useConfig } from '../../hooks/queries/config';
import { useSpaceMembers } from '../../hooks/queries/spaceMembers/useSpaceMembers';
import { useHideMutedSpaces } from '../../hooks/business/user/useHideMutedSpaces';
import { useSpaceContextMenu } from '../../hooks/business/spaces';
import { useMessageDB } from '../context/useMessageDB';
import { Input, Select, Switch } from '../primitives';
import { SpaceCard } from './SpaceCard';
import type { NavItem } from '../../db/messages';
import './MySpacesTab.scss';

const MySpaceCard: React.FC<{
  space: Space;
  isOwner: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ space, isOwner, onClick, onContextMenu }) => {
  const { data: members } = useSpaceMembers({ spaceId: space.spaceId });
  return (
    <SpaceCard
      variant="my-space"
      iconUrl={space.iconUrl}
      spaceId={space.spaceId}
      spaceName={space.spaceName}
      memberCount={members?.length ?? 0}
      isOwner={isOwner}
      onClick={onClick}
      onContextMenu={onContextMenu}
    />
  );
};

export const MySpacesTab: React.FC = () => {
  const navigate = useNavigate();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address || '';
  const { data: spaces } = useSpaces({});
  const { data: config } = useConfig({ userAddress });
  const { hideMutedSpaces, toggleHideMutedSpaces } = useHideMutedSpaces();
  const { messageDB } = useMessageDB();
  const { openContextMenu, contextMenu } = useSpaceContextMenu();

  const [search, setSearch] = React.useState('');
  const [folderId, setFolderId] = React.useState<string>('all');

  const folders = React.useMemo(() => {
    const items = config?.items || [];
    return items.filter(
      (item): item is Extract<NavItem, { type: 'folder' }> => item.type === 'folder'
    );
  }, [config?.items]);

  const folderOptions = React.useMemo(() => {
    return [
      { label: t`All folders`, value: 'all' },
      ...folders.map((f) => ({ label: f.name, value: f.id })),
    ];
  }, [folders]);

  const [ownerMap, setOwnerMap] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!spaces || spaces.length === 0) return;
    let cancelled = false;
    (async () => {
      const result: Record<string, boolean> = {};
      for (const space of spaces) {
        try {
          const ownerKey = await messageDB.getSpaceKey(space.spaceId, 'owner');
          result[space.spaceId] = !!ownerKey;
        } catch {
          result[space.spaceId] = false;
        }
      }
      if (!cancelled) setOwnerMap(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [spaces, messageDB]);

  // Intentionally NOT filtering by hideMutedSpaces here — the toggle is scoped
  // to the sidebar (see Switch label). My Spaces tab is the full inventory.
  const filteredSpaces = React.useMemo(() => {
    let result: Space[] = spaces ?? [];

    if (folderId !== 'all') {
      const folder = folders.find((f) => f.id === folderId);
      if (folder) {
        const ids = new Set(folder.spaceIds);
        result = result.filter((s) => ids.has(s.spaceId));
      }
    }

    if (search.trim()) {
      const needle = search.toLowerCase().trim();
      result = result.filter((s) => s.spaceName.toLowerCase().includes(needle));
    }

    return result;
  }, [spaces, folderId, folders, search]);

  return (
    <div className="my-spaces-tab">
      <div className="my-spaces-tab__header">
        <Input
          className="my-spaces-tab__search"
          value={search}
          onChange={setSearch}
          placeholder={t`Find a Space...`}
          variant="bordered"
        />
        <Select
          value={folderId}
          onChange={(value: string | string[]) => setFolderId(value as string)}
          options={folderOptions}
          size="medium"
          variant="bordered"
        />
        <label className="my-spaces-tab__toggle">
          <Switch value={hideMutedSpaces} onChange={() => toggleHideMutedSpaces()} />
          <span>{t`Hide muted Spaces from sidebar`}</span>
        </label>
      </div>

      <div className="my-spaces-tab__grid">
        {filteredSpaces.length === 0 ? (
          <div className="my-spaces-tab__empty">
            {search.trim() || folderId !== 'all'
              ? t`No Spaces match the current filters.`
              : t`No Spaces yet — discover public Spaces or paste an invite link.`}
          </div>
        ) : (
          filteredSpaces.map((space) => {
            const handleContextMenu = (e: React.MouseEvent) =>
              openContextMenu({
                spaceId: space.spaceId,
                spaceName: space.spaceName,
                iconUrl: space.iconUrl,
                event: e,
              });
            return (
              <React.Suspense
                key={space.spaceId}
                fallback={
                  <SpaceCard
                    variant="my-space"
                    iconUrl={space.iconUrl}
                    spaceId={space.spaceId}
                    spaceName={space.spaceName}
                    memberCount={0}
                    isOwner={ownerMap[space.spaceId] ?? false}
                    onClick={() => {}}
                    onContextMenu={handleContextMenu}
                  />
                }
              >
                <MySpaceCard
                  space={space}
                  isOwner={ownerMap[space.spaceId] ?? false}
                  onClick={() => {
                    const firstChannel = space.groups?.[0]?.channels?.[0]?.channelId;
                    if (firstChannel) {
                      navigate(`/spaces/${space.spaceId}/${firstChannel}`);
                    } else {
                      navigate(`/spaces/${space.spaceId}`);
                    }
                  }}
                  onContextMenu={handleContextMenu}
                />
              </React.Suspense>
            );
          })
        )}
      </div>
      {contextMenu}
    </div>
  );
};
