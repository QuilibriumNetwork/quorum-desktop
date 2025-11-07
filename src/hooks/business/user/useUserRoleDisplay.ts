import { useMemo } from 'react';
import { Role } from '../../../api/quorumApi';

export const useUserRoleDisplay = (
  userAddress: string,
  roles?: Role[],
  includePrivateRoles: boolean = false // When true, includes private roles (for space owners managing roles)
) => {
  const userRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter((r) =>
      r.members.includes(userAddress) &&
      (includePrivateRoles || r.isPublic !== false)
    );
  }, [roles, userAddress, includePrivateRoles]);

  const availableRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter((r) =>
      !r.members.includes(userAddress) &&
      (includePrivateRoles || r.isPublic !== false)
    );
  }, [roles, userAddress, includePrivateRoles]);

  return {
    userRoles,
    availableRoles,
  };
};
