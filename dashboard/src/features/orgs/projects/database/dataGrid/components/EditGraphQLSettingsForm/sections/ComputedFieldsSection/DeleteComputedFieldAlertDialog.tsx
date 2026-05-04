import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { useComputedFieldMetadataMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useComputedFieldMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  ComputedFieldItem,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';

export interface DeleteComputedFieldAlertDialogProps {
  field: ComputedFieldItem;
  table: QualifiedTable;
  source: string;
  disabled?: boolean;
}

export default function DeleteComputedFieldAlertDialog({
  field,
  table,
  source,
  disabled,
}: DeleteComputedFieldAlertDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { mutateAsync: deleteComputedField } = useComputedFieldMetadataMutation(
    { type: 'delete' },
  );

  const handleConfirm = async () => {
    setIsDeleting(true);

    await execPromiseWithErrorToast(
      () =>
        deleteComputedField({
          args: { table, name: field.name, source },
          original: field,
        }),
      {
        loadingMessage: 'Deleting computed field...',
        successMessage: 'Computed field deleted successfully.',
        errorMessage: 'Failed to delete computed field.',
      },
    );

    setIsDeleting(false);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={disabled}
        data-testid={`delete-computed-field-${field.name}`}
      >
        <Trash2Icon className="size-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent
          className="text-foreground"
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Computed Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the{' '}
              <span className="rounded-md bg-muted px-1 py-0.5 font-mono">
                {field.name}
              </span>{' '}
              computed field? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <ButtonWithLoading
              variant="destructive"
              onClick={handleConfirm}
              disabled={isDeleting}
              loading={isDeleting}
              className="text-white"
            >
              Delete
            </ButtonWithLoading>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
