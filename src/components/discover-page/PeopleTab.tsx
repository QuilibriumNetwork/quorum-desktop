import * as React from 'react';
import { t } from '@lingui/core/macro';
import { Icon, Input } from '../primitives';
import './PeopleTab.scss';

/**
 * People tab — public user profiles.
 *
 * Placeholder. Public profiles are stored per-address on the server
 * (`GET /users/:addr/public-profile`) but no list/search endpoint exists
 * yet, so we show an empty state until that lands. The search input is
 * wired but inert.
 */
export const PeopleTab: React.FC = () => {
  const [search, setSearch] = React.useState('');

  return (
    <div className="people-tab">
      <div className="people-tab__header">
        <div className="people-tab__search">
          <Input
            type="search"
            variant="bordered"
            value={search}
            onChange={setSearch}
            placeholder={t`Search by name or address...`}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="empty-state empty-state--fill">
        <Icon name="users" size="5xl" className="empty-state__icon" />
        <p className="empty-state__title">
          {t`Public profiles aren't searchable yet.`}
        </p>
      </div>
    </div>
  );
};

export default PeopleTab;
