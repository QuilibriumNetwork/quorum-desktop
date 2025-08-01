import { useMemo } from 'react';
import { Role } from '../../../api/quorumApi';

export const useUserRoleDisplay = (userAddress: string, roles?: Role[]) => {
  const userRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter((r) => r.members.includes(userAddress));
  }, [roles, userAddress]);

  const availableRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter((r) => !r.members.includes(userAddress));
  }, [roles, userAddress]);

  return {
    userRoles,
    availableRoles,
  };
};