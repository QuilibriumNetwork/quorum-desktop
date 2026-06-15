import { useState, useCallback, useEffect } from 'react';
import React from 'react';
import {
  setRolePermissions,
  toggleRolePermission as toggleRolePermissionShared,
  getDefaultRoleColor,
  getUniqueRoleDefaults,
  type Permission,
  type Role,
} from '@quilibrium/quorum-shared';
import { useConfirmation } from '../../ui/useConfirmation';
import RolePreview from '../../../components/space/RolePreview';
import { t } from '@lingui/core/macro';

export interface UseRoleManagementOptions {
  initialRoles?: Role[];
}

export interface UseRoleManagementReturn {
  roles: Role[];
  setRoles: (roles: Role[]) => void;
  addRole: () => void;
  deleteRole: (e: React.MouseEvent, index: number) => void;
  updateRoleTag: (index: number, roleTag: string) => void;
  updateRoleDisplayName: (index: number, displayName: string) => void;
  toggleRolePermission: (index: number, permission: Permission) => void;
  updateRolePermissions: (index: number, permissions: Permission[]) => void;
  toggleRolePublic: (index: number) => void;
  deleteConfirmation: {
    showModal: boolean;
    setShowModal: (show: boolean) => void;
    modalConfig?: any;
  };
}

export const useRoleManagement = (
  options: UseRoleManagementOptions = {}
): UseRoleManagementReturn => {
  const { initialRoles = [] } = options;
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [roleToDelete, setRoleToDelete] = useState<{ role: Role; index: number } | null>(null);

  // Update roles when initialRoles changes (e.g., when space data loads)
  useEffect(() => {
    setRoles(initialRoles);
  }, [initialRoles]);

  const addRole = useCallback(() => {
    setRoles((prev) => {
      const roleId = crypto.randomUUID();
      // Auto-number the tag/name against existing roles so repeatedly hitting
      // "Add Role" never produces duplicates ("New Role 2" / "newrole-2", …).
      const { displayName, roleTag } = getUniqueRoleDefaults(prev);
      const newRole: Role = {
        roleId,
        roleTag,
        displayName,
        // Deterministic palette token (resolved to hex at render); syncs across
        // platforms, unlike the legacy 'rgb(var(--success))' css-var.
        color: getDefaultRoleColor(roleId),
        members: [],
        permissions: [],
        isPublic: true, // New roles are public by default
      };
      return [...prev, newRole];
    });
  }, []);

  // Confirmation hook for role delete action
  const deleteConfirmation = useConfirmation({
    type: 'modal',
    enableShiftBypass: false, // Disable shift bypass for role deletion
    modalConfig: roleToDelete ? {
      title: t`Delete Role`,
      message: t`Are you sure you want to delete this role?`,
      preview: React.createElement(RolePreview, { role: roleToDelete.role }),
      confirmText: t`Delete`,
      cancelText: t`Cancel`,
      variant: 'danger',
    } : undefined,
  });

  const deleteRole = useCallback((e: React.MouseEvent, index: number) => {
    const role = roles[index];
    setRoleToDelete({ role, index });
    
    const performDelete = () => {
      setRoles((prev) => prev.filter((_, i) => i !== index));
      setRoleToDelete(null);
    };
    
    deleteConfirmation.handleClick(e, performDelete);
  }, [roles, deleteConfirmation]);

  const updateRoleTag = useCallback((index: number, roleTag: string) => {
    setRoles((prev) =>
      prev.map((role, i) => (i === index ? { ...role, roleTag } : role))
    );
  }, []);

  const updateRoleDisplayName = useCallback(
    (index: number, displayName: string) => {
      setRoles((prev) =>
        prev.map((role, i) => (i === index ? { ...role, displayName } : role))
      );
    },
    []
  );

  const toggleRolePermission = useCallback(
    (index: number, permission: Permission) => {
      setRoles((prev) =>
        prev.map((role, i) => (i === index ? toggleRolePermissionShared(role, permission) : role))
      );
    },
    []
  );

  const updateRolePermissions = useCallback(
    (index: number, permissions: Permission[]) => {
      setRoles((prev) =>
        prev.map((role, i) => (i === index ? setRolePermissions(role, permissions) : role))
      );
    },
    []
  );

  const toggleRolePublic = useCallback(
    (index: number) => {
      setRoles((prev) =>
        prev.map((role, i) => {
          if (i !== index) return role;
          return { ...role, isPublic: role.isPublic === false };
        })
      );
    },
    []
  );

  return {
    roles,
    setRoles,
    addRole,
    deleteRole,
    updateRoleTag,
    updateRoleDisplayName,
    toggleRolePermission,
    updateRolePermissions,
    toggleRolePublic,
    deleteConfirmation,
  };
};
