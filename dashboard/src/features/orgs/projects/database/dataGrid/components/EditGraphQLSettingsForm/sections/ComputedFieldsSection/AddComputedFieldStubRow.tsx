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
import { useComputedFieldMetadataMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useComputedFieldMetadataMutation';
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
  schemas: string[];
  isFunctionsLoading?: boolean;
  isSchemasLoading?: boolean;
  disabled?: boolean;
  isExpanded: boolean;
  onOpenChange: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function AddComputedFieldStubRow({
  table,
  source,
  functions,
  schemas,
  isFunctionsLoading,
  isSchemasLoading,
  disabled,
  isExpanded,
  onOpenChange,
  onDirtyChange,
}: AddComputedFieldStubRowProps) {
  const { mutateAsync: createComputedField } = useComputedFieldMetadataMutation(
    { type: 'add' },
  );

  const form = useForm<ComputedFieldFormValues>({
    defaultValues: defaultComputedFieldValues,
    resolver: zodResolver(computedFieldValidationSchema),
  });

  const { isSubmitting, isDirty } = form.formState;
  const isReportingDirty = isDirty && isExpanded;

  useEffect(() => {
    if (!isReportingDirty) {
      return undefined;
    }
    onDirtyChange?.(true);
    return () => onDirtyChange?.(false);
  }, [isReportingDirty, onDirtyChange]);

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

    await execPromiseWithErrorToast(() => createComputedField({ args }), {
      loadingMessage: 'Adding computed field...',
      successMessage: 'Computed field added successfully.',
      errorMessage: 'Failed to add computed field.',
    });

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
              schemas={schemas}
              table={table}
              isFunctionsLoading={isFunctionsLoading}
              isSchemasLoading={isSchemasLoading}
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
