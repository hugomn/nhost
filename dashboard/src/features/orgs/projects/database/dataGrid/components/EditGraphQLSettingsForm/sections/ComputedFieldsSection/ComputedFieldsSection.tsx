import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { usePostgresFunctionsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { useTableComputedFieldsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableComputedFieldsQuery';
import AddComputedFieldStubRow from './AddComputedFieldStubRow';
import ComputedFieldRow from './ComputedFieldRow';
import ComputedFieldsSectionSkeleton from './ComputedFieldsSectionSkeleton';

const DEFAULT_SOURCE = 'default';

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
    queryOptions: { enabled: !isUntracked },
  });

  const [expandedRowName, setExpandedRowName] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

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

  const computedFieldsErrorMessage =
    computedFieldsError instanceof Error
      ? computedFieldsError.message
      : 'An error occurred while loading the computed fields.';

  const functionsErrorMessage =
    functionsError instanceof Error
      ? functionsError.message
      : 'An error occurred while loading the available functions.';

  return (
    <div className="flex flex-col gap-4 px-6 pb-4">
      <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
        <div className="grid grid-flow-col place-content-between gap-3 px-4">
          <div className="grid grid-flow-row gap-1">
            <h2 className="font-semibold text-lg">Computed Fields</h2>
            <p className="text-muted-foreground text-sm+">
              Expose Postgres function results as virtual columns in your
              GraphQL API.
            </p>
          </div>
        </div>

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
                    isFunctionsLoading={isLoadingFunctions}
                    disabled={disabled}
                    isExpanded={expandedRowName === field.name}
                    onOpenChange={handleRowOpenChange(field.name)}
                  />
                ))}
              </>
            )}

            <AddComputedFieldStubRow
              table={table}
              source={DEFAULT_SOURCE}
              functions={functions}
              isFunctionsLoading={isLoadingFunctions}
              disabled={disabled}
              isExpanded={isAddingNew}
              onOpenChange={handleStubOpenChange}
            />
          </div>
        )}

        {isUntracked && (
          <p className="px-4 text-muted-foreground text-sm">
            Track this table to manage its computed fields.
          </p>
        )}
      </div>
    </div>
  );
}
