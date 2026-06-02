import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Button, Icon } from '../primitives';
import { DiscoverTab } from './DiscoverTab';
import { useOptionalShellState } from '../shell/useShellState';
import './SpacesPage.scss';

/**
 * Phone-only header strip with the drawer trigger. Empty-hint and Discover
 * views don't have their own chat-header, so this gives the user a way to
 * reach the navigation drawer on phone widths.
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
    <div className="spaces-page__empty">
      <Icon name="users-group" size="3xl" />
      <p>{t`Select a space from the sidebar to start chatting.`}</p>
    </div>
  </>
);

export const SpacesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isDiscover = searchParams.get('tab') === 'discover';

  if (!isDiscover) {
    return <EmptyHint />;
  }

  return (
    <div className="spaces-page">
      <PhoneHeader />
      <div className="spaces-page__content" role="tabpanel">
        <React.Suspense fallback={<div className="spaces-page__loading">{t`Loading...`}</div>}>
          <DiscoverTab />
        </React.Suspense>
      </div>
    </div>
  );
};
