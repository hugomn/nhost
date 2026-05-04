import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { Form } from '@/components/ui/v3/form';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCreateComputedFieldMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateComputedFieldMutation';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';
import ComputedFieldFormFields from './ComputedFieldFormFields';
import {
  type ComputedFieldFormValues,
  computedFieldValidationSchema,
  defaultComputedFieldValues,
  formValuesToAddComputedFieldArgs,
} from './computedFieldFormTypes';

export interface AddComputedFieldStubRowProps {
  table: QualifiedTable;
  source: string;
  functions: PostgresFunction[];
  isFunctionsLoading?: boolean;
  disabled?: boolean;
  isExpanded: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddComputedFieldStubRow({
  table,
  source,
  functions,
  isFunctionsLoading,
  disabled,
  isExpanded,
  onOpenChange,
}: AddComputedFieldStubRowProps) {
  const isPlatform = useIsPlatform();
  const { refetch: refetchResourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: createComputedField } = useCreateComputedFieldMutation();

  const form = useForm<ComputedFieldFormValues>({
    defaultValues: defaultComputedFieldValues,
    resolver: zodResolver(computedFieldValidationSchema),
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (!isExpanded) {
      form.reset(defaultComputedFieldValues);
    }
  }, [isExpanded, form]);

  const handleCancel = () => {
    form.reset(defaultComputedFieldValues);
    onOpenChange(false);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const args = formValuesToAddComputedFieldArgs(values, table, source);

    await execPromiseWithErrorToast(
      async () => {
        if (isPlatform) {
          const { data: latestResourceVersion } =
            await refetchResourceVersion();
          await createComputedField({
            resourceVersion: latestResourceVersion!,
            args,
          });
        } else {
          await createComputedField({ args });
        }
      },
      {
        loadingMessage: 'Adding computed field...',
        successMessage: 'Computed field added successfully.',
        errorMessage: 'Failed to add computed field.',
      },
    );

    form.reset(defaultComputedFieldValues);
    onOpenChange(false);
  });

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onOpenChange}
      disabled={disabled}
      className="overflow-hidden rounded-md border-1 border-dashed"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 px-4 py-3 text-muted-foreground text-sm transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="add-computed-field-stub"
        >
          <PlusIcon className="size-4" />
          Add computed field
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 border-t bg-muted/30 px-4 py-4"
          >
            <ComputedFieldFormFields
              mode="create"
              functions={functions}
              table={table}
              isFunctionsLoading={isFunctionsLoading}
              disabled={disabled || isSubmitting}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <ButtonWithLoading
                type="submit"
                loading={isSubmitting}
                disabled={disabled}
                className="text-white"
              >
                Add
              </ButtonWithLoading>
            </div>
          </form>
        </Form>
      </CollapsibleContent>
    </Collapsible>
  );
}
