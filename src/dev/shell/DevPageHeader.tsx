import React from 'react';
import { Icon, type IconName } from '../../components/primitives';

interface DevPageHeaderProps {
  icon: IconName;
  title: string;
  /** One line on what the tool measures or does. */
  subtitle?: React.ReactNode;
  /** Right-aligned controls, e.g. Refresh / Copy. */
  actions?: React.ReactNode;
}

/**
 * One header shape for every dev tool.
 *
 * It replaces five different treatments that had drifted apart: centered
 * icon+title with no subtitle, icon+title+subtitle, the same plus right-aligned
 * actions, a bare `<h1>` with no icon, and no header at all.
 *
 * The icon is top-aligned with the title rather than centered against the whole
 * block — centering made it float oddly between the title and subtitle on the
 * pages that had both.
 *
 * Plain HTML with the semantic typography classes, not the `Text` primitive,
 * which is native-only.
 */
export const DevPageHeader: React.FC<DevPageHeaderProps> = ({
  icon,
  title,
  subtitle,
  actions,
}) => (
  <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
    <div className="flex items-start gap-3">
      <Icon name={icon} size="xl" className="text-accent shrink-0 mt-1" />
      <div>
        {/* 30px, one step above `.text-title-large` (24px). The semantic scale
            tops out at 24 because it was written for modals and dialogs, and
            these are standalone full pages whose sections need room to be
            prominent underneath. Section headings sit at 24px, body below that,
            so the hierarchy stays 30 > 24 > 16/14. */}
        <h1 className="text-3xl font-bold text-strong">{title}</h1>
        {subtitle && <p className="text-label">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);
