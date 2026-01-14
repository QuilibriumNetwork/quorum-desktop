import React from 'react';
import { Role } from '../../api/quorumApi';
import { Container, Text, Icon, Flex } from '../primitives';
import { t } from '@lingui/core/macro';

interface RolePreviewProps {
  role: Role;
}

export const RolePreview: React.FC<RolePreviewProps> = ({ role }) => {
  return (
    <Container padding="sm" backgroundColor="var(--color-bg-chat)">
      <Flex direction="column" gap="sm">
        {/* Role name with icon */}
        <Flex align="center" gap="xs">
          <Icon name="star" size="xs" />
          <Text variant="main" size="sm">
            {role.displayName}
          </Text>
        </Flex>
        
        {/* Member count */}
        <Flex align="center" gap="xs">
          <Icon name="users" size="xs" />
          <Text variant="main" size="sm">
            {role.members?.length || 0} member{role.members?.length !== 1 ? 's' : ''}
          </Text>
        </Flex>

        {/* Permissions */}
        <Flex align="start" gap="xs">
          <Icon name="shield" size="xs" style={{ marginTop: 2 }} />
          <Text variant="main" size="sm">
            {t`Permissions:`}{' '}
            {role.permissions && role.permissions.length > 0 ?
              role.permissions.map(permission =>
                permission.replace('_', ' ').toLowerCase()
              ).join(', ')
              : t`None`
            }
          </Text>
        </Flex>
      </Flex>
    </Container>
  );
};

export default RolePreview;