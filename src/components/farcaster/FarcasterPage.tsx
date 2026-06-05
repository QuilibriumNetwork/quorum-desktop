import * as React from 'react';
import { t } from '@lingui/core/macro';
import { Button, Icon } from '../primitives';
import { useOptionalShellState } from '../shell/useShellState';
import './FarcasterPage.scss';

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

export const FarcasterPage: React.FC = () => {
  return (
    <div className="farcaster-page">
      <PhoneHeader />
      <div className="farcaster-page__inner">
        <h1 className="farcaster-page__title">{t`Farcaster`}</h1>
        <div className="empty-state empty-state--fill">
          <Icon name="globe" size="5xl" className="empty-state__icon" />
          <p className="empty-state__title">{t`Coming soon`}</p>
        </div>
      </div>
    </div>
  );
};

export default FarcasterPage;
