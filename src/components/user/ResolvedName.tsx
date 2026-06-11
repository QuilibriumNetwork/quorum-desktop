import * as React from 'react';
import type { ResolvedMemberName } from '../../utils/resolveMemberName';

interface ResolvedNameProps {
  resolved: ResolvedMemberName;
  className?: string;
}

/**
 * Renders a resolved member name, appending ".q" (same styling as the name) when
 * it's the verified QNS username. Single render site so the suffix can't drift
 * across surfaces. For string contexts use `formatResolvedName`.
 */
export const ResolvedName: React.FunctionComponent<ResolvedNameProps> = ({
  resolved,
  className,
}) => {
  return (
    <span className={className}>
      {resolved.name}
      {resolved.isQnsVerified && '.q'}
    </span>
  );
};
