import React from 'react';
import { Flex, Text, Icon } from '../../../components/primitives';
import { type MarkdownFile } from '../hooks/useMarkdownFiles';
import {
  asList,
  formatFieldValue,
  partitionFrontmatter,
} from '../utils/frontmatterDisplay';

/**
 * The metadata box above a document's body.
 *
 * Shows every frontmatter field the file carries, not a curated subset — see
 * `frontmatterDisplay.ts` for why. Recognised fields come first, anything
 * pointing at other work is grouped, and the long tail of one-off keys lands in
 * a final section instead of vanishing.
 */

const formatDate = (value: string): string => {
  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const DATE_FIELDS = new Set(['created', 'updated', 'completed']);

const Entry: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex gap-2">
    <Text variant="subtle" size="sm" className="shrink-0">
      {label}:
    </Text>
    {children}
  </div>
);

export const FrontmatterPanel: React.FC<{ file: MarkdownFile }> = ({ file }) => {
  const { primary, relations, other } = partitionFrontmatter(
    file.frontmatter as Record<string, unknown> | undefined
  );

  const hasAnything =
    file.status || primary.length > 0 || relations.length > 0 || other.length > 0;

  if (!hasAnything && !file.parseError) return null;

  return (
    <div className="bg-surface-2 rounded-lg border border-default p-3 mb-6">
      {/* A file whose YAML threw has no metadata at all — say so, rather than
          rendering an empty box that looks like an issue with nothing to show. */}
      {file.parseError && (
        <div className="bg-danger/10 border border-danger/30 rounded-md p-3 mb-3">
          <Flex gap="sm" align="center" className="mb-1">
            <Icon name="warning" size="sm" className="text-danger" />
            <Text variant="strong" size="sm" className="text-danger">
              Frontmatter could not be parsed
            </Text>
          </Flex>
          <Text variant="subtle" size="sm">
            {file.parseError}
          </Text>
          <Text variant="muted" size="sm" className="mt-1">
            Everything below is missing because of it. Fix the YAML at the top of
            the file, then re-run <code>yarn scan-docs</code>.
          </Text>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
        {/* State comes from the folder, not from `status:` — see deriveState. */}
        {file.status && (
          <Entry label="State">
            <Text
              variant="main"
              size="sm"
              weight="medium"
              className="capitalize"
            >
              {file.status.replace(/-/g, ' ')}
            </Text>
          </Entry>
        )}

        {primary.map((field) => (
          <Entry key={field.key} label={field.label}>
            <Text variant="main" size="sm" weight="medium">
              {DATE_FIELDS.has(field.key)
                ? formatDate(formatFieldValue(field.value))
                : formatFieldValue(field.value)}
            </Text>
          </Entry>
        ))}
      </div>

      {relations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-default space-y-2">
          {relations.map((field) => (
            <div key={field.key} className="flex flex-wrap gap-2 items-baseline">
              <Text variant="subtle" size="sm" className="shrink-0">
                {field.label}:
              </Text>
              <div className="flex flex-wrap gap-1">
                {asList(field.value).map((entry, index) => (
                  <Text
                    key={`${entry}-${index}`}
                    variant="main"
                    size="sm"
                    className="bg-surface-3 px-1.5 py-0.5 rounded font-mono"
                  >
                    {entry}
                  </Text>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div className="mt-3 pt-3 border-t border-default space-y-2">
          <Text variant="muted" size="sm" weight="medium">
            Other fields
          </Text>
          {other.map((field) => (
            <div key={field.key} className="flex flex-wrap gap-2 items-baseline">
              <Text variant="subtle" size="sm" className="shrink-0">
                {field.label}:
              </Text>
              <Text variant="main" size="sm">
                {formatFieldValue(field.value)}
              </Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
