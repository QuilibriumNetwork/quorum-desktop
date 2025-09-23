import * as React from 'react';
import { Button, Select, Icon, Tooltip, ScrollContainer } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Permission } from '../../../api/quorumApi';

interface Role {
  roleTag: string;
  displayName: string;
  color: string;
  permissions: Permission[];
}

interface RolesProps {
  roles: Role[];
  addRole: () => void;
  deleteRole: (e: React.MouseEvent, index: number) => void;
  updateRoleTag: (index: number, tag: string) => void;
  updateRoleDisplayName: (index: number, name: string) => void;
  updateRolePermissions: (index: number, permissions: Permission[]) => void;
  roleValidationError: string;
  onSave: () => void;
  isSaving: boolean;
}

const Roles: React.FunctionComponent<RolesProps> = ({
  roles,
  addRole,
  deleteRole,
  updateRoleTag,
  updateRoleDisplayName,
  updateRolePermissions,
  roleValidationError,
  onSave,
  isSaving,
}) => {
  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-xl font-bold">
            <Trans>Roles</Trans>
          </div>
          <div className="pt-2 text-sm text-main">
            <Trans>
              Click on the role name and tag to edit them.
            </Trans>
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <div className="flex mb-4">
          <Button
            type="secondary"
            className="!w-auto !inline-flex"
            onClick={addRole}
          >
            <Trans>Add Role</Trans>
          </Button>
        </div>
        {roles.length > 0 && (
          <ScrollContainer height="md">
            {roles.map((r, i) => {
            return (
              <div
                key={'space-editor-role-' + i}
                className="modal-list-item text-main px-3"
              >
                <div
                  className="flex flex-col gap-4 py-4 sm:grid sm:grid-cols-[1fr_1fr_auto]"
                >
                  {/* Cell 1: Role tag and name */}
                  <div className="flex flex-col">
                    <div>
                      @
                      <input
                        className="border-0 bg-[rgba(0,0,0,0)] pr-2 outline-none focus:bg-surface-1 focus:px-2 focus:py-1 focus:rounded transition-all font-mono"
                        style={{
                          width:
                            (roles.find((_, pi) => i == pi)
                              ?.roleTag.length ?? 0) *
                              11 +
                            11 +
                            'px',
                        }}
                        onChange={(e) =>
                          updateRoleTag(i, e.target.value)
                        }
                        value={r.roleTag}
                      />
                    </div>
                    <div className="mt-1">
                      <span
                        className="font-mono modal-role"
                        style={{ backgroundColor: r.color }}
                      >
                        <input
                          className="border-0 bg-[rgba(0,0,0,0)] outline-none focus:bg-[rgba(0,0,0,0.1)] focus:px-2 focus:py-1 focus:rounded transition-all"
                          style={{
                            width:
                              Math.max(
                                (r.displayName.length || 3) * 8,
                                60
                              ) + 'px',
                          }}
                          onChange={(e) =>
                            updateRoleDisplayName(
                              i,
                              e.target.value
                            )
                          }
                          value={r.displayName}
                        />
                      </span>
                    </div>
                  </div>

                  {/* Cell 2: Permissions */}
                  <div className="flex flex-col">
                    <div className="text-sm font-normal">
                      <Trans>Permissions:</Trans>
                    </div>
                    <div className="mt-1">
                      <Select
                        multiple
                        variant="bordered"
                        value={
                          roles.find((_, pi) => i == pi)
                            ?.permissions || []
                        }
                        onChange={(selectedPermissions: string | string[]) =>
                          updateRolePermissions(
                            i,
                            selectedPermissions as Permission[]
                          )
                        }
                        placeholder={t`Select permissions`}
                        width="200px"
                        options={[
                          {
                            value: 'message:delete',
                            label: t`Delete Messages`,
                          },
                          {
                            value: 'message:pin',
                            label: t`Pin Messages`,
                          },
                          {
                            value: 'user:kick',
                            label: t`Kick Users`,
                          },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Cell 3: Delete button */}
                  <div className="flex flex-col">
                    <div className="flex justify-start sm:justify-end">
                      <Tooltip
                        id={`delete-role-${i}`}
                        content={t`Delete Role`}
                        place="left"
                        showOnTouch={false}
                      >
                        <Icon
                          name="trash"
                          className="cursor-pointer text-danger hover:text-danger-hover"
                          onClick={(e) => deleteRole(e, i)}
                        />
                      </Tooltip>
                    </div>
                    <div className="mt-1">
                      {/* Empty space for alignment */}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </ScrollContainer>
        )}
        {roleValidationError && (
          <div
            className="mt-4 text-sm"
            style={{ color: 'var(--color-text-danger)' }}
          >
            {roleValidationError}
          </div>
        )}
        <div className="modal-content-info"></div>
      </div>
    </>
  );
};

export default Roles;