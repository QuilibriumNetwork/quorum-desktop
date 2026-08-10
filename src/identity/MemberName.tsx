import * as React from 'react';
import { UserAvatar } from '../components/user/UserAvatar';
import { useResolvedMemberName, type UseResolvedNameOptions } from './useResolvedName';

interface MemberNameProps extends UseResolvedNameOptions {
  address: string;
  className?: string;
  /** Render the avatar beside the name, from the SAME resolved identity. */
  withAvatar?: boolean;
  avatarSize?: number;
  userIcon?: string;
}

/**
 * The only name-rendering API.
 *
 * Owns the ".q" suffix and, when asked, the avatar — because computing the two
 * separately is how a member came to render "gatto.q" next to a circle reading
 * "G" for GattoPardo. The operator's rule: the initials must always render
 * whatever the displayed name is at that moment.
 */
export const MemberName: React.FunctionComponent<MemberNameProps> = ({
  address,
  className,
  withAvatar = false,
  avatarSize = 30,
  userIcon,
  ...opts
}) => {
  const resolved = useResolvedMemberName(address, opts);

  const label = (
    <span className={className}>
      {resolved.name}
      {resolved.isQnsVerified && '.q'}
    </span>
  );

  if (!withAvatar) return label;

  return (
    <>
      <UserAvatar
        userIcon={userIcon}
        // BARE name: getInitials splits on non-letters, so "gatto.q" would
        // produce two initials from a single name.
        displayName={resolved.name}
        address={address}
        size={avatarSize}
      />
      {label}
    </>
  );
};
