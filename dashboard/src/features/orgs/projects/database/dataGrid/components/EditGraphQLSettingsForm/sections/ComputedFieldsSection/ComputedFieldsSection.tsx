import { useCallback, useEffect, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { usePostgresFunctionsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { useTableComputedFieldsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableComputedFieldsQuery';
import AddComputedFieldStubRow from './AddComputedFieldStubRow';
import ComputedFieldRow from './ComputedFieldRow';
import ComputedFieldsSectionShell from './ComputedFieldsSectionShell';
import ComputedFieldsSectionSkeleton from './ComputedFieldsSectionSkeleton';

const DEFAULT_SOURCE = 'default';
const DIRTY_SOURCE_ID = 'edit-gql-computed-fields';

export interface ComputedFieldsSectionProps {
  disabled?: boolean;
  isUntracked?: boolean;
  schema: string;
  tableName: string;
}

export default function ComputedFieldsSection({
  disabled,
  isUntracked,
  schema,
  tableName,
}: ComputedFieldsSectionProps) {
  const { setDirtySource } = useDialog();
  const table = { name: tableName, schema };

  const {
    data: computedFields,
    isLoading: isLoadingComputedFields,
    error: computedFieldsError,
    isError: isComputedFieldsError,
  } = useTableComputedFieldsQuery({
    table,
    dataSource: DEFAULT_SOURCE,
  });

  const {
    data: functionsData,
    isLoading: isLoadingFunctions,
    error: functionsError,
    isError: isFunctionsError,
  } = usePostgresFunctionsQuery({
    dataSource: DEFAULT_SOURCE,
    queryOptions: {
      enabled: !isUntracked,
      refetchOnWindowFocus: 'always',
    },
  });

  const {
    data: databaseData,
    isLoading: isLoadingSchemas,
    error: schemasError,
    isError: isSchemasError,
  } = useDatabaseQuery([DEFAULT_SOURCE], {
    queryOptions: { enabled: !isUntracked },
  });

  const [expandedRowName, setExpandedRowName] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const [dirtyChildCount, setDirtyChildCount] = useState(0);
  const isAnyChildDirty = dirtyChildCount > 0;

  const reportChildDirty = useCallback((dirty: boolean) => {
    setDirtyChildCount((prev) => prev + (dirty ? 1 : -1));
  }, []);

  useEffect(() => {
    setDirtySource(DIRTY_SOURCE_ID, isAnyChildDirty);
    return () => {
      setDirtySource(DIRTY_SOURCE_ID, false);
    };
  }, [isAnyChildDirty, setDirtySource]);

  const handleRowOpenChange = (name: string) => (open: boolean) => {
    if (open) {
      setExpandedRowName(name);
      setIsAddingNew(false);
    } else if (expandedRowName === name) {
      setExpandedRowName(null);
    }
  };

  const handleStubOpenChange = (open: boolean) => {
    setIsAddingNew(open);
    if (open) {
      setExpandedRowName(null);
    }
  };

  if (isLoadingComputedFields) {
    return <ComputedFieldsSectionSkeleton />;
  }

  const fields = computedFields ?? [];
  const functions = functionsData?.functions ?? [];
  const schemas = (databaseData?.schemas ?? []).map(
    ({ schema_name: schemaName }) => schemaName as string,
  );

  const computedFieldsErrorMessage =
    computedFieldsError instanceof Error
      ? computedFieldsError.message
      : 'An error occurred while loading the computed fields.';

  const functionsErrorMessage =
    functionsError instanceof Error
      ? functionsError.message
      : 'An error occurred while loading the available functions.';

  const schemasErrorMessage =
    schemasError instanceof Error
      ? schemasError.message
      : 'An error occurred while loading the available schemas.';

  return (
    <ComputedFieldsSectionShell>
      {isComputedFieldsError && (
        <div className="px-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load computed fields</AlertTitle>
            <AlertDescription>{computedFieldsErrorMessage}</AlertDescription>
          </Alert>
        </div>
      )}

      {isFunctionsError && !isUntracked && (
        <div className="px-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load available functions</AlertTitle>
            <AlertDescription>{functionsErrorMessage}</AlertDescription>
          </Alert>
        </div>
      )}

      {isSchemasError && !isUntracked && (
        <div className="px-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load available schemas</AlertTitle>
            <AlertDescription>{schemasErrorMessage}</AlertDescription>
          </Alert>
        </div>
      )}

      {!isUntracked && !isComputedFieldsError && (
        <div className="grid gap-2 px-4">
          {fields.length === 0 ? (
            <p className="rounded-md bg-muted/30 px-4 py-3 text-center text-muted-foreground text-sm">
              No computed fields configured.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_5.25rem] items-center gap-3 rounded-md bg-muted px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <span>Name</span>
                <span>Function</span>
                <span>Comment</span>
                <span className="sr-only">Actions</span>
              </div>
              {fields.map((field) => (
                <ComputedFieldRow
                  key={field.name}
                  field={field}
                  table={table}
                  source={DEFAULT_SOURCE}
                  functions={functions}
                  schemas={schemas}
                  isFunctionsLoading={isLoadingFunctions}
                  isSchemasLoading={isLoadingSchemas}
                  disabled={disabled}
                  isExpanded={expandedRowName === field.name}
                  onOpenChange={handleRowOpenChange(field.name)}
                  onDirtyChange={reportChildDirty}
                />
              ))}
            </>
          )}

          <AddComputedFieldStubRow
            table={table}
            source={DEFAULT_SOURCE}
            functions={functions}
            schemas={schemas}
            isFunctionsLoading={isLoadingFunctions}
            isSchemasLoading={isLoadingSchemas}
            disabled={disabled}
            isExpanded={isAddingNew}
            onOpenChange={handleStubOpenChange}
            onDirtyChange={reportChildDirty}
          />
        </div>
      )}

      {isUntracked && (
        <p className="px-4 text-muted-foreground text-sm">
          Track this table to manage its computed fields.
        </p>
      )}
    </ComputedFieldsSectionShell>
  );
}
