import * as React from 'react';
import { t } from '@lingui/core/macro';
import SpaceIcon from '../navbar/SpaceIcon';
import { Button, Icon, Tooltip } from '../primitives';
import './SpaceCard.scss';

function formatMemberCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

interface SpaceCardMyServerProps {
  variant: 'my-server';
  iconUrl?: string;
  spaceId: string;
  spaceName: string;
  memberCount: number;
  isOwner: boolean;
  onClick: () => void;
}

interface SpaceCardPublicProps {
  variant: 'public';
  iconUrl?: string;
  spaceAddress: string;
  spaceName: string;
  memberCount: number;
  category: string;
  description: string;
  onJoin: () => void;
  isJoining?: boolean;
  alreadyJoined?: boolean;
}

type SpaceCardProps = SpaceCardMyServerProps | SpaceCardPublicProps;

const MemberCount: React.FC<{ count: number }> = ({ count }) => (
  <span className="space-card__members">
    <Icon name="users" size="sm" />
    {formatMemberCount(count)}
  </span>
);

export const SpaceCard: React.FC<SpaceCardProps> = (props) => {
  if (props.variant === 'my-server') {
    return (
      <div
        className="space-card space-card--my-server cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={props.onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            props.onClick();
          }
        }}
        aria-label={t`Open ${props.spaceName}`}
      >
        <div className="space-card__icon">
          <SpaceIcon
            iconUrl={props.iconUrl}
            spaceName={props.spaceName}
            spaceId={props.spaceId}
            size="regular"
            selected={false}
            notifs={false}
            noTooltip={true}
            noToggle={true}
          />
        </div>
        <div className="space-card__body">
          <div className="space-card__name-row">
            <span className="space-card__name">{props.spaceName}</span>
            {props.isOwner && (
              <Tooltip
                id={`owner-${props.spaceId}`}
                content={t`You are the owner of this Space`}
                place="top"
              >
                <Icon name="crown" size="sm" className="space-card__owner-badge" />
              </Tooltip>
            )}
          </div>
          <MemberCount count={props.memberCount} />
        </div>
      </div>
    );
  }

  const joinLabel = props.alreadyJoined
    ? t`Already joined`
    : props.isJoining
      ? t`Joining...`
      : t`Join`;

  const [expanded, setExpanded] = React.useState(false);

  // Threshold roughly matches what fits in 2 lines on the squared card width.
  // Above this, "More" is rendered inline after a truncated preview.
  const TRUNCATE_AT = 110;
  const needsTruncation = props.description.length > TRUNCATE_AT;
  const truncated = needsTruncation
    ? props.description.slice(0, TRUNCATE_AT).trimEnd() + '…'
    : props.description;

  return (
    <div className={`space-card space-card--public ${expanded ? 'space-card--expanded' : ''}`}>
      <div className="space-card__icon">
        <SpaceIcon
          iconUrl={props.iconUrl}
          spaceName={props.spaceName}
          spaceId={props.spaceAddress}
          size="large"
          selected={false}
          notifs={false}
          noTooltip={true}
          noToggle={true}
        />
      </div>
      <div className="space-card__name-row">
        <span className="space-card__name">{props.spaceName}</span>
      </div>
      <span className="space-card__meta">
        <span className="space-card__category">{props.category}</span>
        <span aria-hidden="true">·</span>
        <MemberCount count={props.memberCount} />
      </span>
      {props.description && (
        <p className="space-card__description">
          {expanded || !needsTruncation ? props.description : truncated}
          {needsTruncation && !expanded && (
            <>
              {' '}
              <button
                type="button"
                className="space-card__more cursor-pointer"
                onClick={() => setExpanded(true)}
              >
                {t`More`}
              </button>
            </>
          )}
        </p>
      )}
      {needsTruncation && expanded && (
        <button
          type="button"
          className="space-card__more space-card__more--less cursor-pointer"
          onClick={() => setExpanded(false)}
        >
          {t`Show less`}
        </button>
      )}
      <div className="space-card__actions">
        <Button
          type="secondary"
          onClick={props.onJoin}
          disabled={props.isJoining || props.alreadyJoined}
          fullWidth
        >
          {joinLabel}
        </Button>
      </div>
    </div>
  );
};
