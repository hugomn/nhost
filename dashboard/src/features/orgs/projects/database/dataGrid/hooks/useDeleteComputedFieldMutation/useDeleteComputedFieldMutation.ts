import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { DeleteComputedFieldVariables } from './deleteComputedField';
import deleteComputedField from './deleteComputedField';
import type { DeleteComputedFieldMigrationVariables } from './deleteComputedFieldMigration';
import deleteComputedFieldMigration from './deleteComputedFieldMigration';

export interface UseDeleteComputedFieldMutationOptions {
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    DeleteComputedFieldVariables | DeleteComputedFieldMigrationVariables
  >;
}

/**
 * Deletes a computed field. Branches between Hasura's metadata API
 * (platform mode) and the migrations API (local mode); the latter records
 * a rollback that re-adds the field with its full original definition.
 */
export default function useDeleteComputedFieldMutation({
  mutationOptions,
}: UseDeleteComputedFieldMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    DeleteComputedFieldVariables | DeleteComputedFieldMigrationVariables
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
        return deleteComputedField({
          ...(variables as DeleteComputedFieldVariables),
          ...base,
        });
      }

      return deleteComputedFieldMigration({
        ...(variables as DeleteComputedFieldMigrationVariables),
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
