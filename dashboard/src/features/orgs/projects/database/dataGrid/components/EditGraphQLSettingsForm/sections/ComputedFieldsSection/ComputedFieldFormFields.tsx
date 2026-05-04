import { ExternalLink, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { singular } from 'pluralize';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormCombobox } from '@/components/form/FormCombobox';
import { FormInput } from '@/components/form/FormInput';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { isComputedFieldFunction } from '@/features/orgs/projects/database/dataGrid/utils/isComputedFieldFunction';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';
import type { ComputedFieldFormValues } from './computedFieldFormTypes';
import FunctionDefinitionPreview from './FunctionDefinitionPreview';

function buildCreateFunctionTemplate({
  schema,
  table,
}: {
  schema: string;
  table: QualifiedTable;
}) {
  const rowArgName = `${singular(table.name)}_row`;
  return `-- Computed field function for "${table.schema}.${table.name}"
-- The first argument "${rowArgName}" must accept a row of "${table.schema}.${table.name}".
CREATE OR REPLACE FUNCTION ${schema}.my_computed_field(${rowArgName} ${table.schema}.${table.name})
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT ''::text;
$$;
`;
}

export interface ComputedFieldFormFieldsProps {
  mode: 'create' | 'edit';
  functions: PostgresFunction[];
  schemas: string[];
  table: QualifiedTable;
  isFunctionsLoading?: boolean;
  isSchemasLoading?: boolean;
  disabled?: boolean;
}

export default function ComputedFieldFormFields({
  mode,
  functions,
  schemas,
  table,
  isFunctionsLoading,
  isSchemasLoading,
  disabled,
}: ComputedFieldFormFieldsProps) {
  const { query } = useRouter();
  const { control, watch, setValue } =
    useFormContext<ComputedFieldFormValues>();

  const selectedSchema = watch('functionSchema');
  const selectedFunctionName = watch('functionName');

  const schemaOptions: { value: string; label: ReactNode }[] = useMemo(
    () =>
      [...schemas].sort().map((schema) => ({ value: schema, label: schema })),
    [schemas],
  );

  const functionsInSelectedSchema = useMemo(
    () =>
      functions.filter(
        (fn) =>
          fn.function_schema === selectedSchema &&
          isComputedFieldFunction(fn, table),
      ),
    [functions, selectedSchema, table],
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

  const selectedFunction = useMemo(
    () =>
      functionsInSelectedSchema.find(
        (fn) => fn.function_name === selectedFunctionName,
      ),
    [functionsInSelectedSchema, selectedFunctionName],
  );

  const openSqlEditorWith = useCallback(
    (sqlSource: string) => {
      const { orgSlug, appSubdomain, dataSourceSlug } = query;
      if (
        typeof orgSlug !== 'string' ||
        typeof appSubdomain !== 'string' ||
        typeof dataSourceSlug !== 'string'
      ) {
        return;
      }
      const url = `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/editor?sql=${encodeURIComponent(sqlSource)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [query],
  );

  const handleCreateNewFunction = useCallback(() => {
    const fnSchema = selectedSchema || table.schema;
    openSqlEditorWith(buildCreateFunctionTemplate({ schema: fnSchema, table }));
  }, [openSqlEditorWith, selectedSchema, table]);

  const handleEditSelectedFunction = useCallback(() => {
    if (!selectedFunction?.function_definition) {
      return;
    }
    openSqlEditorWith(selectedFunction.function_definition);
  }, [openSqlEditorWith, selectedFunction]);

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
        className="!bg-background"
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
          isSchemasLoading ? 'Loading schemas...' : 'No schemas available.'
        }
        options={schemaOptions}
        disabled={fieldsDisabled || isSchemasLoading}
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
            : 'No compatible functions in this schema.'
        }
        options={functionOptions}
        disabled={fieldsDisabled || isFunctionsLoading || !selectedSchema}
        footerAction={{
          label: (
            <>
              <Plus className="mr-2 h-4 w-4" />
              <span>New Function</span>
              <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
            </>
          ),
          onSelect: handleCreateNewFunction,
          'data-testid': 'computed-field-new-function-action',
        }}
      />
      {selectedFunction?.function_definition && (
        <FunctionDefinitionPreview
          functionLabel={`${selectedFunction.function_schema}.${selectedFunction.function_name}`}
          definition={selectedFunction.function_definition}
          onEditInSqlEditor={handleEditSelectedFunction}
        />
      )}
      <FormInput
        control={control}
        name="tableArgument"
        label={
          <div className="flex flex-row items-center gap-2">
            Table Row Argument{' '}
            <InfoTooltip>
              The argument of the function that receives the table row. Defaults
              to the first argument.
            </InfoTooltip>
          </div>
        }
        placeholder="first argument (default)"
        disabled={fieldsDisabled}
        autoComplete="off"
        className="!bg-background"
      />
      <FormInput
        control={control}
        name="sessionArgument"
        label={
          <div className="flex flex-row items-center gap-2">
            Session Argument{' '}
            <InfoTooltip>
              The argument that receives the Hasura session as JSON.
            </InfoTooltip>
          </div>
        }
        placeholder="hasura_session"
        disabled={fieldsDisabled}
        autoComplete="off"
        className="!bg-background"
      />
      <FormInput
        control={control}
        name="comment"
        label="Comment"
        placeholder={commentPlaceholder}
        disabled={fieldsDisabled}
        autoComplete="off"
        className="!bg-background"
      />
    </div>
  );
}
