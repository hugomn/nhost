import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormCombobox } from '@/components/form/FormCombobox';
import { FormInput } from '@/components/form/FormInput';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import type { ComputedFieldFormValues } from './computedFieldFormTypes';

export interface ComputedFieldFormFieldsProps {
  mode: 'create' | 'edit';
  functions: PostgresFunction[];
  isFunctionsLoading?: boolean;
  disabled?: boolean;
}

export default function ComputedFieldFormFields({
  mode,
  functions,
  isFunctionsLoading,
  disabled,
}: ComputedFieldFormFieldsProps) {
  const { control, watch, setValue } =
    useFormContext<ComputedFieldFormValues>();

  const selectedSchema = watch('functionSchema');
  const selectedFunctionName = watch('functionName');

  const schemaOptions: { value: string; label: ReactNode }[] = useMemo(() => {
    const unique = Array.from(
      new Set(functions.map((fn) => fn.function_schema)),
    );
    unique.sort();
    return unique.map((schema) => ({ value: schema, label: schema }));
  }, [functions]);

  const functionsInSelectedSchema = useMemo(
    () => functions.filter((fn) => fn.function_schema === selectedSchema),
    [functions, selectedSchema],
  );

  const functionOptions: { value: string; label: ReactNode }[] = useMemo(
    () =>
      functionsInSelectedSchema.map((fn) => ({
        value: fn.function_name,
        label: (
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="font-mono text-sm">{fn.function_name}</span>
            <span className="truncate text-muted-foreground text-xs">
              ({fn.function_arguments || 'no arguments'})
            </span>
          </span>
        ),
      })),
    [functionsInSelectedSchema],
  );

  useEffect(() => {
    if (
      selectedFunctionName &&
      !functionsInSelectedSchema.some(
        (fn) => fn.function_name === selectedFunctionName,
      )
    ) {
      setValue('functionName', '', { shouldDirty: true });
    }
  }, [selectedFunctionName, functionsInSelectedSchema, setValue]);

  const commentPlaceholder =
    selectedSchema && selectedFunctionName
      ? `A computed field, executes function ${selectedSchema}.${selectedFunctionName}`
      : 'A computed field, executes function ';

  const fieldsDisabled = Boolean(disabled);

  return (
    <div className="grid gap-4">
      <FormInput
        control={control}
        name="name"
        label="Computed Field Name"
        placeholder="full_name"
        disabled={fieldsDisabled || mode === 'edit'}
        autoComplete="off"
        helperText={
          mode === 'edit'
            ? 'The name of an existing computed field cannot be changed. Delete it and add a new one to rename.'
            : null
        }
      />
      <FormCombobox
        control={control}
        name="functionSchema"
        label="Function Schema"
        placeholder="Select a schema"
        searchPlaceholder="Search schemas..."
        emptyText={
          isFunctionsLoading ? 'Loading schemas...' : 'No schemas available.'
        }
        options={schemaOptions}
        disabled={fieldsDisabled || isFunctionsLoading}
      />
      <FormCombobox
        control={control}
        name="functionName"
        label="Function Name"
        placeholder={
          selectedSchema ? 'Select a function' : 'Select a schema first'
        }
        searchPlaceholder="Search functions..."
        emptyText={
          isFunctionsLoading
            ? 'Loading functions...'
            : 'No functions in this schema.'
        }
        options={functionOptions}
        disabled={fieldsDisabled || isFunctionsLoading || !selectedSchema}
      />
      <FormInput
        control={control}
        name="tableArgument"
        label="Table Row Argument"
        placeholder="first argument (default)"
        disabled={fieldsDisabled}
        autoComplete="off"
        helperText="The argument of the function that receives the table row. Defaults to the first argument."
      />
      <FormInput
        control={control}
        name="sessionArgument"
        label="Session Argument"
        placeholder="hasura_session"
        disabled={fieldsDisabled}
        autoComplete="off"
        helperText="The argument that receives the Hasura session as JSON."
      />
      <FormInput
        control={control}
        name="comment"
        label="Comment"
        placeholder={commentPlaceholder}
        disabled={fieldsDisabled}
        autoComplete="off"
      />
    </div>
  );
}
