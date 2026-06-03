import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Button, Icon } from '../primitives';
import { DiscoverTab } from './DiscoverTab';
import { PeopleTab } from './PeopleTab';
import { useOptionalShellState } from '../shell/useShellState';
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

const EmptyHint: React.FC = () => (
  <>
    <PhoneHeader />
    <div className="discover-page__empty">
      <Icon name="users-group" size="3xl" />
      <p>{t`Select a space from the sidebar to start chatting.`}</p>
    </div>
  </>
);

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
    return <EmptyHint />;
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
