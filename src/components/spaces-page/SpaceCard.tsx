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
}

type SpaceCardProps = SpaceCardMyServerProps | SpaceCardPublicProps;

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
          <span className="space-card__meta">
            {formatMemberCount(props.memberCount)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-card space-card--public">
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
      <div className="space-card__body">
        <div className="space-card__name-row">
          <span className="space-card__name">{props.spaceName}</span>
        </div>
        <span className="space-card__meta">
          {props.category} · {formatMemberCount(props.memberCount)}
        </span>
        <Tooltip
          id={`desc-${props.spaceAddress}`}
          content={props.description}
          place="top"
        >
          <p className="space-card__description">{props.description}</p>
        </Tooltip>
        <div className="space-card__actions">
          <Button
            type="primary"
            onClick={props.onJoin}
            disabled={props.isJoining}
          >
            {props.isJoining ? t`Joining...` : t`Join`}
          </Button>
        </div>
      </div>
    </div>
  );
};
