import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Button, Icon } from '../primitives';
import { DiscoverTab } from './DiscoverTab';
import { PeopleTab } from './PeopleTab';
import { useOptionalShellState } from '../shell/useShellState';
import { useSpaceModals } from '../context/SpaceModalsProvider';
import type { IconName } from '@quilibrium/quorum-shared';
import './DiscoverPage.scss';

/**
 * Phone-only header strip with the drawer trigger. Tab views don't have their
 * own chat-header, so this gives the user a way to reach the navigation
 * drawer on phone widths.
 */
const PhoneHeader: React.FC = () => {
  const shell = useOptionalShellState();
  if (!shell || shell.viewport !== 'phone') return null;
  return (
    <div className="chat-header text-main">
      <Button
        type="unstyled"
        onClick={shell.openDrawer}
        className="header-icon-button"
        iconName="menu"
        iconSize="lg"
        iconOnly
        ariaLabel={t`Open navigation`}
      />
    </div>
  );
};

interface SpacesEmptyCardProps {
  icon: IconName;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
}

const SpacesEmptyCard: React.FC<SpacesEmptyCardProps> = ({
  icon,
  title,
  description,
  cta,
  onClick,
}) => (
  <button
    type="button"
    className="spaces-empty__card"
    onClick={onClick}
    aria-label={title}
  >
    <Icon name={icon} size="4xl" className="spaces-empty__card-icon" />
    <span className="spaces-empty__card-title">{title}</span>
    <span className="spaces-empty__card-description">{description}</span>
    <span className="spaces-empty__card-cta">
      {cta}
      <Icon name="arrow-right" size="sm" />
    </span>
  </button>
);

const SpacesEmpty: React.FC = () => {
  const navigate = useNavigate();
  const { showAddSpaceModal, showCreateSpaceModal } = useSpaceModals();

  return (
    <>
      <PhoneHeader />
      <div className="spaces-empty">
        <div className="spaces-empty__cards">
          <SpacesEmptyCard
            icon="compass"
            title={t`Discover spaces`}
            description={t`Browse public spaces and find a community to join.`}
            cta={t`Explore`}
            onClick={() => navigate('/discover/spaces')}
          />
          <SpacesEmptyCard
            icon="link"
            title={t`Join a space`}
            description={t`Got an invite link? Hop straight in.`}
            cta={t`Join`}
            onClick={showAddSpaceModal}
          />
          <SpacesEmptyCard
            icon="plus"
            title={t`Create a space`}
            description={t`Start your own private or public community.`}
            cta={t`Create`}
            onClick={showCreateSpaceModal}
          />
        </div>
      </div>
    </>
  );
};

/**
 * Discover surface. Sub-pages are real routes:
 *  - `/discover/spaces` (default): browse public spaces
 *  - `/discover/people`: browse public user profiles
 *
 * Legacy: when mounted via `mode='spaces-empty'` (from `/spaces` route),
 * renders the spaces empty hint — preserves what the SpacesPage used to do.
 */
export const DiscoverPage: React.FC<{ mode?: 'discover' | 'spaces-empty' }> = ({
  mode = 'discover',
}) => {
  const location = useLocation();

  if (mode === 'spaces-empty') {
    return <SpacesEmpty />;
  }

  const isPeople = location.pathname.startsWith('/discover/people');

  return (
    <div className="discover-page">
      <PhoneHeader />
      <div className="discover-page__content" role="tabpanel">
        <React.Suspense
          fallback={<div className="discover-page__loading">{t`Loading...`}</div>}
        >
          {isPeople ? <PeopleTab /> : <DiscoverTab />}
        </React.Suspense>
      </div>
    </div>
  );
};
