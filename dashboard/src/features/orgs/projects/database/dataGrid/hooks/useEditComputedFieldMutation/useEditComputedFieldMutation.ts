import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { EditComputedFieldVariables } from './editComputedField';
import editComputedField from './editComputedField';
import type { EditComputedFieldMigrationVariables } from './editComputedFieldMigration';
import editComputedFieldMigration from './editComputedFieldMigration';

export interface UseEditComputedFieldMutationOptions {
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    EditComputedFieldVariables | EditComputedFieldMigrationVariables
  >;
}

/**
 * Updates a computed field by dropping it and re-adding it with the new
 * definition (Hasura cannot mutate a computed field in place). Branches
 * between Hasura's metadata API (platform mode) and the migrations API
 * (local mode); the latter records a rollback that restores the original
 * definition.
 */
export default function useEditComputedFieldMutation({
  mutationOptions,
}: UseEditComputedFieldMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    EditComputedFieldVariables | EditComputedFieldMigrationVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const base = {
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      } as const;

      if (isPlatform) {
        return editComputedField({
          ...(variables as EditComputedFieldVariables),
          ...base,
        });
      }

      return editComputedFieldMigration({
        ...(variables as EditComputedFieldMigrationVariables),
        ...base,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (...args) => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        mutationOptions?.onSuccess?.(...args);
      },
    },
  );

  return mutation;
}
