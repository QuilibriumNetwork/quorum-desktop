import * as React from 'react';
import { t } from '@lingui/core/macro';
import { getColorFromDisplayName } from '@quilibrium/quorum-shared';
import SpaceIcon from '../navbar/SpaceIcon';
import { Button, Icon, Tooltip } from '../primitives';
import './SpaceCard.scss';

function formatMemberCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

interface SpaceCardMySpaceProps {
  variant: 'my-space';
  iconUrl?: string;
  spaceId: string;
  spaceName: string;
  memberCount: number;
  isOwner: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
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

type SpaceCardProps = SpaceCardMySpaceProps | SpaceCardPublicProps;

const MemberCount: React.FC<{ count: number }> = ({ count }) => (
  <span className="space-card__members">
    <Icon name="users" size="sm" />
    {formatMemberCount(count)}
  </span>
);

const MySpaceCardView: React.FC<SpaceCardMySpaceProps> = (props) => (
  <div
    className="space-card space-card--my-space cursor-pointer"
    role="button"
    tabIndex={0}
    onClick={props.onClick}
    onContextMenu={props.onContextMenu}
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

const PublicSpaceCardView: React.FC<SpaceCardPublicProps> = (props) => {
  const [expanded, setExpanded] = React.useState(false);

  // Threshold roughly matches what fits in 2 lines on the card width.
  // Above this, "More" is rendered inline after a truncated preview.
  const TRUNCATE_AT = 110;
  const needsTruncation = props.description.length > TRUNCATE_AT;
  const truncated = needsTruncation
    ? props.description.slice(0, TRUNCATE_AT).trimEnd() + '…'
    : props.description;

  const joinLabel = props.alreadyJoined
    ? t`Already joined`
    : props.isJoining
      ? t`Joining...`
      : t`Join`;

  // Hero placeholder: enlarged + blurred icon image when we have one;
  // otherwise a solid colour derived from the space name (same hash used by
  // SpaceIcon for initials backgrounds, so the hero and the icon agree).
  const heroFallbackColor = getColorFromDisplayName(props.spaceName);

  return (
    <div className={`space-card space-card--public ${expanded ? 'space-card--expanded' : ''}`}>
      <div
        className="space-card__hero"
        style={props.iconUrl ? undefined : { backgroundColor: heroFallbackColor }}
        aria-hidden="true"
      >
        {props.iconUrl && (
          <div
            className="space-card__hero-fill"
            style={{ backgroundImage: `url(${props.iconUrl})` }}
          />
        )}
      </div>
      <div className="space-card__icon">
        <SpaceIcon
          iconUrl={props.iconUrl}
          spaceName={props.spaceName}
          spaceId={props.spaceAddress}
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
    </div>
  );
};

export const SpaceCard: React.FC<SpaceCardProps> = (props) =>
  props.variant === 'my-space' ? <MySpaceCardView {...props} /> : <PublicSpaceCardView {...props} />;
