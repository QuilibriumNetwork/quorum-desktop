import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import type { Channel as ChannelType, Group } from '@quilibrium/quorum-shared';
import { Button, Icon, Tooltip } from '../../primitives';
import { useQueryClient } from '@tanstack/react-query';
import { useSpace, buildSpaceKey } from '../../../hooks';
import { isTouchDevice } from '../../../utils/platform';
import { useMessageDB } from '../../context/useMessageDB';
import {
  useMoveChannel,
  useReorderGroups,
  useReorderChannels,
} from '../../../hooks/business/channels';
import { getIconColorHex } from '../../space/IconPicker/types';
import ChannelEditorModal from '../ChannelEditorModal';
import GroupEditorModal from '../GroupEditorModal';
import ConfirmationModal from '../ConfirmationModal';
import ChannelPreview from '../../space/ChannelPreview';
import { showToast } from '../../../utils/toast';

interface ChannelsProps {
  spaceId: string;
}

const COLLAPSED_GROUPS_STORAGE_KEY = 'channelsTab.collapsedGroups';

function useCollapsedGroups(spaceId: string) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as Record<string, string[]>;
      return new Set(parsed[spaceId] ?? []);
    } catch {
      return new Set();
    }
  });

  const persist = React.useCallback(
    (next: Set<string>) => {
      try {
        const raw = localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
        if (next.size === 0) {
          delete parsed[spaceId];
        } else {
          parsed[spaceId] = Array.from(next);
        }
        localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // localStorage unavailable; in-memory state still works
      }
    },
    [spaceId]
  );

  const toggle = React.useCallback(
    (groupName: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(groupName)) next.delete(groupName);
        else next.add(groupName);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { collapsed, toggle };
}

type DragData =
  | { type: 'group'; groupIndex: number }
  | {
      type: 'channel';
      channelId: string;
      parentGroupIndex: number;
    };

const Channels: React.FunctionComponent<ChannelsProps> = ({ spaceId }) => {
  const { data: space } = useSpace({ spaceId });
  const { updateSpace, messageDB } = useMessageDB();
  const queryClient = useQueryClient();
  const moveChannelMutation = useMoveChannel(spaceId);
  const reorderGroupsMutation = useReorderGroups(spaceId);
  const reorderChannelsMutation = useReorderChannels(spaceId);

  const [activeDrag, setActiveDrag] = React.useState<DragData | null>(null);
  const { collapsed, toggle: toggleCollapsed } = useCollapsedGroups(spaceId);
  const [pendingDelete, setPendingDelete] = React.useState<
    | { kind: 'group'; groupName: string; channelCount: number }
    | {
        kind: 'channel';
        groupName: string;
        channelId: string;
        channelName: string;
        messageCount: number;
      }
    | null
  >(null);
  const [groupEditor, setGroupEditor] = React.useState<
    { mode: 'add' } | { mode: 'edit'; groupName: string } | null
  >(null);
  const [channelEditor, setChannelEditor] = React.useState<
    | { mode: 'add'; groupName: string }
    | { mode: 'edit'; groupName: string; channelId: string }
    | null
  >(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isTouchDevice()
        ? { distance: 15 } // Touch: 15px movement, no delay (matches NavMenu pattern)
        : { distance: 8 },
    })
  );

  const groups = space?.groups ?? [];
  const defaultChannelId = space?.defaultChannelId;

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) setActiveDrag(data);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;
    if (!activeData || !overData) return;

    // Compute "before" vs "after" intent based on dragged item's final center
    // relative to the target's vertical midpoint
    const overRect = over.rect;
    const activeRect = active.rect.current.translated;
    let isAfter = false;
    if (overRect && activeRect) {
      const activeCenterY = activeRect.top + activeRect.height / 2;
      const overMidY = overRect.top + overRect.height / 2;
      isAfter = activeCenterY > overMidY;
    }

    // Scenario 1: group is being dragged. Nested sortables + closestCenter
    // can pick a CHANNEL inside another group as the closest target, so
    // resolve to that channel's parent group instead.
    if (activeData.type === 'group') {
      const targetGroupIndex =
        overData.type === 'group' ? overData.groupIndex : overData.parentGroupIndex;
      const from = activeData.groupIndex;
      let to = targetGroupIndex;
      if (isAfter && to < from) to = to + 1;
      if (!isAfter && to > from) to = to - 1;
      if (from === to) return;
      const groupOrder = arrayMove(
        groups.map((_, i) => i),
        from,
        to
      );
      reorderGroupsMutation.mutate({ spaceId, groupOrder });
      return;
    }

    // Channel dropped on channel
    if (activeData.type === 'channel' && overData.type === 'channel') {
      const targetGroupIndex = overData.parentGroupIndex;
      const targetGroup = groups[targetGroupIndex];
      const overIdx = targetGroup.channels.findIndex(
        (c) => c.channelId === overData.channelId
      );
      if (overIdx === -1) return;

      const insertAt = isAfter ? overIdx + 1 : overIdx;

      if (activeData.parentGroupIndex === targetGroupIndex) {
        const ids = targetGroup.channels.map((c) => c.channelId);
        const fromIdx = ids.indexOf(activeData.channelId);
        if (fromIdx === -1) return;
        const toIdx = insertAt > fromIdx ? insertAt - 1 : insertAt;
        if (fromIdx === toIdx) return;
        const channelOrder = arrayMove(ids, fromIdx, toIdx);
        reorderChannelsMutation.mutate({
          spaceId,
          groupIndex: targetGroupIndex,
          channelOrder,
        });
      } else {
        moveChannelMutation.mutate({
          spaceId,
          channelId: activeData.channelId,
          fromGroupIndex: activeData.parentGroupIndex,
          toGroupIndex: targetGroupIndex,
          toPosition: insertAt,
        });
      }
      return;
    }

    // Channel dropped on group (header or empty body) → append to end
    if (activeData.type === 'channel' && overData.type === 'group') {
      if (activeData.parentGroupIndex === overData.groupIndex) return;
      const targetGroup = groups[overData.groupIndex];
      moveChannelMutation.mutate({
        spaceId,
        channelId: activeData.channelId,
        fromGroupIndex: activeData.parentGroupIndex,
        toGroupIndex: overData.groupIndex,
        toPosition: targetGroup.channels.length,
      });
      return;
    }
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
  };

  const handleDeleteGroup = (group: Group) => {
    const hasDefault = group.channels.some((c) => c.channelId === defaultChannelId);
    if (hasDefault) {
      showToast(t`Cannot delete a group containing the default channel.`, 'error');
      return;
    }
    setPendingDelete({
      kind: 'group',
      groupName: group.groupName,
      channelCount: group.channels.length,
    });
  };

  const handleDeleteChannel = async (group: Group, channel: ChannelType) => {
    let messageCount = 0;
    try {
      const result = await messageDB.getMessages({
        spaceId,
        channelId: channel.channelId,
        limit: 50,
      });
      messageCount = result.messages.length;
    } catch (error) {
      console.error('Error checking channel messages:', error);
    }
    setPendingDelete({
      kind: 'channel',
      groupName: group.groupName,
      channelId: channel.channelId,
      channelName: channel.channelName,
      messageCount,
    });
  };

  const handleSetDefault = async (channelId: string) => {
    if (!space || space.defaultChannelId === channelId) return;
    const updatedSpace = {
      ...space,
      defaultChannelId: channelId,
      modifiedDate: Date.now(),
    };
    // Optimistic cache flip so the star UI swaps instantly; updateSpace
    // persists in the background (encrypt + sign + POST + broadcast + save).
    queryClient.setQueryData(buildSpaceKey({ spaceId }), updatedSpace);
    try {
      await updateSpace(updatedSpace);
    } catch (err) {
      queryClient.setQueryData(buildSpaceKey({ spaceId }), space);
      throw err;
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !space) return;
    if (pendingDelete.kind === 'group') {
      await updateSpace({
        ...space,
        groups: space.groups.filter((g) => g.groupName !== pendingDelete.groupName),
        modifiedDate: Date.now(),
      });
    } else {
      await updateSpace({
        ...space,
        groups: space.groups.map((g) =>
          g.groupName === pendingDelete.groupName
            ? {
                ...g,
                channels: g.channels.filter(
                  (c) => c.channelId !== pendingDelete.channelId
                ),
              }
            : g
        ),
        modifiedDate: Date.now(),
      });
    }
    setPendingDelete(null);
  };

  const draggedChannel = React.useMemo(() => {
    if (activeDrag?.type !== 'channel') return null;
    const g = groups[activeDrag.parentGroupIndex];
    return g?.channels.find((c) => c.channelId === activeDrag.channelId) ?? null;
  }, [activeDrag, groups]);

  const draggedGroup = React.useMemo(() => {
    if (activeDrag?.type !== 'group') return null;
    return groups[activeDrag.groupIndex] ?? null;
  }, [activeDrag, groups]);

  if (!space) return null;

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title flex items-center gap-2">
            <Icon name="hashtag" size="lg" />
            <Trans>Channels</Trans>
          </div>
          <div className="pt-2 text-body">
            <Trans>Manage channel groups and channels. Drag to reorder.</Trans>
          </div>
          <div className="pt-3">
            <Button type="secondary" onClick={() => setGroupEditor({ mode: 'add' })}>
              <Icon name="plus" className="mr-2" />
              <Trans>Add Group</Trans>
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6" style={{ touchAction: 'pan-y' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
            <SortableContext items={groups.map((g) => `group:${g.groupName}`)}>
              <div className="flex flex-col gap-3">
                {groups.map((group, groupIndex) => (
                  <SortableGroup
                    key={group.groupName}
                    group={group}
                    groupIndex={groupIndex}
                    defaultChannelId={defaultChannelId}
                    isCollapsed={collapsed.has(group.groupName)}
                    onToggleCollapsed={() => toggleCollapsed(group.groupName)}
                    onEditGroup={() =>
                      setGroupEditor({ mode: 'edit', groupName: group.groupName })
                    }
                    onAddChannel={() =>
                      setChannelEditor({ mode: 'add', groupName: group.groupName })
                    }
                    onDeleteGroup={() => handleDeleteGroup(group)}
                    onEditChannel={(channelId) =>
                      setChannelEditor({
                        mode: 'edit',
                        groupName: group.groupName,
                        channelId,
                      })
                    }
                    onDeleteChannel={(channel) => handleDeleteChannel(group, channel)}
                    onSetDefaultChannel={(channelId) => handleSetDefault(channelId)}
                  />
                ))}
              </div>
            </SortableContext>

            {createPortal(
              <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                {draggedChannel && (
                  <ChannelRowGhost
                    channel={draggedChannel}
                    isDefault={draggedChannel.channelId === defaultChannelId}
                  />
                )}
                {draggedGroup && <GroupHeaderGhost group={draggedGroup} />}
              </DragOverlay>,
              document.body
            )}
        </DndContext>
      </div>

      {groupEditor &&
        createPortal(
          <GroupEditorModal
            spaceId={spaceId}
            groupName={groupEditor.mode === 'edit' ? groupEditor.groupName : undefined}
            dismiss={() => setGroupEditor(null)}
          />,
          document.body
        )}
      {channelEditor &&
        createPortal(
          <ChannelEditorModal
            spaceId={spaceId}
            groupName={channelEditor.groupName}
            channelId={
              channelEditor.mode === 'edit' ? channelEditor.channelId : undefined
            }
            dismiss={() => setChannelEditor(null)}
          />,
          document.body
        )}
      {pendingDelete && pendingDelete.kind === 'channel' && (
        <ConfirmationModal
          visible={true}
          title={t`Delete Channel`}
          message={
            pendingDelete.messageCount > 0
              ? t`Are you sure you want to delete this channel? All messages will be lost. This action cannot be undone.`
              : t`Are you sure you want to delete this channel? This action cannot be undone.`
          }
          preview={
            <ChannelPreview
              channelName={pendingDelete.channelName}
              messageCount={pendingDelete.messageCount}
            />
          }
          confirmText={t`Delete`}
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {pendingDelete && pendingDelete.kind === 'group' && (
        <ConfirmationModal
          visible={true}
          title={t`Delete Group`}
          message={
            pendingDelete.channelCount > 0
              ? t`Are you sure you want to delete this group? All channels inside it and their messages will be lost. This action cannot be undone.`
              : t`Are you sure you want to delete this group? This action cannot be undone.`
          }
          preview={
            <GroupPreview
              groupName={pendingDelete.groupName}
              channelCount={pendingDelete.channelCount}
            />
          }
          confirmText={t`Delete`}
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

interface SortableGroupProps {
  group: Group;
  groupIndex: number;
  defaultChannelId?: string;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onEditGroup: () => void;
  onAddChannel: () => void;
  onDeleteGroup: () => void;
  onEditChannel: (channelId: string) => void;
  onDeleteChannel: (channel: ChannelType) => void;
  onSetDefaultChannel: (channelId: string) => void;
}

const SortableGroup: React.FunctionComponent<SortableGroupProps> = ({
  group,
  groupIndex,
  defaultChannelId,
  isCollapsed,
  onToggleCollapsed,
  onEditGroup,
  onAddChannel,
  onDeleteGroup,
  onEditChannel,
  onDeleteChannel,
  onSetDefaultChannel,
}) => {
  const id = `group:${group.groupName}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: 'group', groupIndex } satisfies DragData,
  });

  return (
    <div
      ref={setNodeRef}
      className="border border-default rounded-lg overflow-hidden"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
      {...attributes}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2.5 bg-surface-4 ${
          isCollapsed ? '' : 'border-b border-default'
        }`}
      >
          <button
            {...listeners}
            aria-label={t`Drag to reorder group`}
            className="cursor-grab active:cursor-grabbing text-muted hover:text-subtle p-1 shrink-0"
          >
            <Icon name="grip-vertical" />
          </button>
          <button
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? t`Expand group` : t`Collapse group`}
            aria-expanded={!isCollapsed}
            className="cursor-pointer p-1 text-muted hover:text-subtle shrink-0"
          >
            <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} />
          </button>
          <div className="flex-1 min-w-0 font-semibold uppercase text-xs tracking-wider truncate">
            {group.icon && (
              <Icon
                name={group.icon as any}
                className="mr-2 inline-block"
                style={{
                  color: group.iconColor
                    ? getIconColorHex(group.iconColor as any)
                    : undefined,
                }}
              />
            )}
            {group.groupName}
          </div>
          <Tooltip
            id={`group-edit-${groupIndex}`}
            content={t`Edit group`}
            place="top"
          >
            <button
              onClick={onEditGroup}
              className="cursor-pointer p-1 text-muted hover:text-subtle"
              aria-label={t`Edit group`}
            >
              <Icon name="edit" />
            </button>
          </Tooltip>
          <Tooltip
            id={`group-add-${groupIndex}`}
            content={t`Add channel`}
            place="top"
          >
            <button
              onClick={onAddChannel}
              className="cursor-pointer p-1 text-muted hover:text-subtle"
              aria-label={t`Add channel to group`}
            >
              <Icon name="plus" />
            </button>
          </Tooltip>
          <Tooltip
            id={`group-delete-${groupIndex}`}
            content={t`Delete group`}
            place="top"
          >
            <button
              onClick={onDeleteGroup}
              className="cursor-pointer p-1 text-muted hover:text-danger"
              aria-label={t`Delete group`}
            >
              <Icon name="trash" />
            </button>
          </Tooltip>
        </div>

        {!isCollapsed && (
        <SortableContext
          items={group.channels.map((c) => `channel:${c.channelId}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col">
            {group.channels.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted italic">
                <Trans>No channels - drag channels here or delete group.</Trans>
              </div>
            ) : (
              group.channels.map((channel) => (
                <SortableChannel
                  key={channel.channelId}
                  channel={channel}
                  parentGroupIndex={groupIndex}
                  isDefault={channel.channelId === defaultChannelId}
                  onEdit={() => onEditChannel(channel.channelId)}
                  onDelete={() => onDeleteChannel(channel)}
                  onSetDefault={() => onSetDefaultChannel(channel.channelId)}
                />
              ))
            )}
          </div>
        </SortableContext>
        )}
    </div>
  );
};

interface SortableChannelProps {
  channel: ChannelType;
  parentGroupIndex: number;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

const SortableChannel: React.FunctionComponent<SortableChannelProps> = ({
  channel,
  parentGroupIndex,
  isDefault,
  onEdit,
  onDelete,
  onSetDefault,
}) => {
  const id = `channel:${channel.channelId}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: 'channel',
      channelId: channel.channelId,
      parentGroupIndex,
    } satisfies DragData,
  });

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-2 px-3 py-2 border-t border-default first:border-t-0"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
      {...attributes}
    >
        <button
          {...listeners}
          aria-label={t`Drag to reorder channel`}
          className="cursor-grab active:cursor-grabbing text-muted hover:text-subtle p-1"
        >
          <Icon name="grip-vertical" />
        </button>
        <Icon
          name={(channel.icon || 'hashtag') as any}
          className="text-muted"
          style={{
            color: channel.iconColor
              ? getIconColorHex(channel.iconColor as any)
              : undefined,
          }}
        />
        <span className="flex-1 truncate">{channel.channelName}</span>
        {channel.isReadOnly && (
          <span className="text-xs px-2 py-0.5 bg-surface-5 rounded flex items-center gap-1 text-muted">
            <Icon name="lock" />
            <Trans>Read-only</Trans>
          </span>
        )}
        <Tooltip
          id={`channel-default-${channel.channelId}`}
          content={
            isDefault
              ? t`Default channel`
              : t`Set as default channel`
          }
          place="top"
        >
          <button
            onClick={isDefault ? undefined : onSetDefault}
            disabled={isDefault}
            className={
              isDefault
                ? 'p-1 text-warning cursor-default'
                : 'cursor-pointer p-1 text-muted hover:text-warning'
            }
            aria-label={
              isDefault
                ? t`Default channel`
                : t`Set as default channel`
            }
          >
            <Icon name="star" variant={isDefault ? 'filled' : 'outline'} />
          </button>
        </Tooltip>
        <Tooltip
          id={`channel-edit-${channel.channelId}`}
          content={t`Edit channel`}
          place="top"
        >
          <button
            onClick={onEdit}
            className="cursor-pointer p-1 text-muted hover:text-subtle"
            aria-label={t`Edit channel`}
          >
            <Icon name="edit" />
          </button>
        </Tooltip>
        <Tooltip
          id={`channel-delete-${channel.channelId}`}
          content={
            isDefault
              ? t`You cannot delete the default channel.`
              : t`Delete channel`
          }
          place="top"
        >
          <button
            onClick={onDelete}
            disabled={isDefault}
            className="cursor-pointer p-1 text-muted hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t`Delete channel`}
          >
            <Icon name="trash" />
          </button>
        </Tooltip>
    </div>
  );
};

const ChannelRowGhost: React.FunctionComponent<{
  channel: ChannelType;
  isDefault: boolean;
}> = ({ channel, isDefault }) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-modal border border-default rounded shadow-lg cursor-grabbing">
    <Icon name="grip-vertical" className="text-muted" />
    <Icon name={(channel.icon || 'hashtag') as any} className="text-muted" />
    <span className="font-medium">{channel.channelName}</span>
    {isDefault && (
      <Icon name="star" variant="filled" className="text-warning" />
    )}
  </div>
);

const GroupPreview: React.FunctionComponent<{
  groupName: string;
  channelCount: number;
}> = ({ groupName, channelCount }) => (
  <div className="p-3 bg-chat rounded">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Icon name="folder" size="xs" />
        <span className="text-label-strong">{groupName}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Icon name="hashtag" size="xs" />
        <span className="text-label-strong">
          {channelCount} {channelCount === 1 ? 'channel' : 'channels'}
        </span>
      </div>
    </div>
  </div>
);

const GroupHeaderGhost: React.FunctionComponent<{ group: Group }> = ({ group }) => (
  <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-4 border border-default rounded shadow-lg cursor-grabbing">
    <Icon name="grip-vertical" className="text-muted shrink-0" />
    <span className="font-semibold uppercase text-xs tracking-wider truncate">
      {group.groupName}
    </span>
  </div>
);

export default Channels;
