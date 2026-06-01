import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Button } from '../primitives';
import { MyServersTab } from './MyServersTab';
import { DiscoverTab } from './DiscoverTab';
import './SpacesPage.scss';

type TabId = 'my-servers' | 'discover';

const TABS: { id: TabId; label: () => string }[] = [
  { id: 'my-servers', label: () => t`My Servers` },
  { id: 'discover', label: () => t`Discover` },
];

export const SpacesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = tabParam === 'discover' ? 'discover' : 'my-servers';

  const setActiveTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'my-servers') {
      next.delete('tab');
    } else {
      next.set('tab', id);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="spaces-page">
      <nav className="spaces-page__tabs" role="tablist" aria-label={t`Spaces`}>
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            type="unstyled"
            className={`spaces-page__tab ${activeTab === tab.id ? 'spaces-page__tab--active' : ''}`}
            ariaLabel={tab.label()}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label()}
          </Button>
        ))}
      </nav>

      <div className="spaces-page__content" role="tabpanel">
        <React.Suspense fallback={<div className="spaces-page__loading">{t`Loading...`}</div>}>
          {activeTab === 'my-servers' && <MyServersTab />}
          {activeTab === 'discover' && <DiscoverTab />}
        </React.Suspense>
      </div>
    </div>
  );
};
