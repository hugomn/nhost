import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { CreateComputedFieldVariables } from './createComputedField';
import createComputedField from './createComputedField';
import type { CreateComputedFieldMigrationVariables } from './createComputedFieldMigration';
import createComputedFieldMigration from './createComputedFieldMigration';

export interface UseCreateComputedFieldMutationOptions {
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    CreateComputedFieldVariables | CreateComputedFieldMigrationVariables
  >;
}

/**
 * Creates a computed field on a tracked table. Branches between Hasura's
 * metadata API (platform mode) and the migrations API (local mode).
 */
export default function useCreateComputedFieldMutation({
  mutationOptions,
}: UseCreateComputedFieldMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    CreateComputedFieldVariables | CreateComputedFieldMigrationVariables
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
        return createComputedField({
          ...(variables as CreateComputedFieldVariables),
          ...base,
        });
      }

      return createComputedFieldMigration({
        ...(variables as CreateComputedFieldMigrationVariables),
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
