import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, PencilIcon } from 'lucide-react';
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
import { useEditComputedFieldMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useEditComputedFieldMutation';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import type {
  ComputedFieldItem,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';
import ComputedFieldFormFields from './ComputedFieldFormFields';
import {
  type ComputedFieldFormValues,
  computedFieldItemToFormValues,
  computedFieldValidationSchema,
  formValuesToAddComputedFieldArgs,
} from './computedFieldFormTypes';
import DeleteComputedFieldAlertDialog from './DeleteComputedFieldAlertDialog';

export interface ComputedFieldRowProps {
  field: ComputedFieldItem;
  table: QualifiedTable;
  source: string;
  functions: PostgresFunction[];
  isFunctionsLoading?: boolean;
  disabled?: boolean;
  isExpanded: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ComputedFieldRow({
  field,
  table,
  source,
  functions,
  isFunctionsLoading,
  disabled,
  isExpanded,
  onOpenChange,
}: ComputedFieldRowProps) {
  const isPlatform = useIsPlatform();
  const { refetch: refetchResourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: editComputedField } = useEditComputedFieldMutation();

  const form = useForm<ComputedFieldFormValues>({
    defaultValues: computedFieldItemToFormValues(field),
    resolver: zodResolver(computedFieldValidationSchema),
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (isExpanded) {
      form.reset(computedFieldItemToFormValues(field));
    }
  }, [isExpanded, field, form]);

  const handleCancel = () => {
    form.reset(computedFieldItemToFormValues(field));
    onOpenChange(false);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const args = formValuesToAddComputedFieldArgs(values, table, source);

    await execPromiseWithErrorToast(
      async () => {
        if (isPlatform) {
          const { data: latestResourceVersion } =
            await refetchResourceVersion();
          await editComputedField({
            resourceVersion: latestResourceVersion!,
            args,
          });
        } else {
          await editComputedField({
            args,
            original: field,
          });
        }
      },
      {
        loadingMessage: 'Updating computed field...',
        successMessage: 'Computed field updated successfully.',
        errorMessage: 'Failed to update computed field.',
      },
    );

    onOpenChange(false);
  });

  const functionLabel = `${field.definition.function.schema}.${field.definition.function.name}`;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onOpenChange}
      disabled={disabled}
      className="overflow-hidden rounded-md border-1"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_auto] items-center gap-3 bg-background px-4 py-3">
        <span className="truncate font-medium font-mono text-foreground text-sm">
          {field.name}
        </span>
        <span className="truncate font-mono text-muted-foreground text-sm">
          {functionLabel}
        </span>
        <span className="truncate text-muted-foreground text-sm">
          {field.comment || '—'}
        </span>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={isExpanded ? 'Close editor' : 'Edit computed field'}
              data-testid={`edit-computed-field-${field.name}`}
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <PencilIcon className="size-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <DeleteComputedFieldAlertDialog
            field={field}
            table={table}
            source={source}
            disabled={disabled || isExpanded}
          />
        </div>
      </div>
      <CollapsibleContent>
        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            className={cn('grid gap-4 border-t bg-muted/30 px-4 py-4')}
          >
            <ComputedFieldFormFields
              mode="edit"
              functions={functions}
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
                Save
              </ButtonWithLoading>
            </div>
          </form>
        </Form>
      </CollapsibleContent>
    </Collapsible>
  );
}
