import { act } from 'react';
import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';
import ComputedFieldFormFields from './ComputedFieldFormFields';
import {
  type ComputedFieldFormValues,
  defaultComputedFieldValues,
} from './computedFieldFormTypes';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const FUNCTIONS: PostgresFunction[] = [
  {
    function_schema: 'public',
    function_name: 'compute_full_name',
    function_arguments: 'row public.users',
  },
  {
    function_schema: 'public',
    function_name: 'calculate_age',
    function_arguments: 'row public.users',
  },
  {
    function_schema: 'analytics',
    function_name: 'lifetime_value',
    function_arguments: 'row public.users',
  },
];

interface TestWrapperProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<ComputedFieldFormValues>;
  functions?: PostgresFunction[];
  isFunctionsLoading?: boolean;
  disabled?: boolean;
  formRef?: { current: UseFormReturn<ComputedFieldFormValues> | null };
}

function TestWrapper({
  mode,
  defaultValues,
  functions = FUNCTIONS,
  isFunctionsLoading,
  disabled,
  formRef,
}: TestWrapperProps) {
  const form = useForm<ComputedFieldFormValues>({
    defaultValues: { ...defaultComputedFieldValues, ...defaultValues },
  });
  if (formRef) {
    formRef.current = form;
  }
  return (
    <FormProvider {...form}>
      <ComputedFieldFormFields
        mode={mode}
        functions={functions}
        isFunctionsLoading={isFunctionsLoading}
        disabled={disabled}
      />
    </FormProvider>
  );
}

describe('ComputedFieldFormFields', () => {
  it('enables the name input in create mode', () => {
    render(<TestWrapper mode="create" />);

    expect(screen.getByLabelText('Computed Field Name')).not.toBeDisabled();
  });

  it('disables the name input in edit mode and shows a helper message', () => {
    render(
      <TestWrapper
        mode="edit"
        defaultValues={{
          name: 'full_name',
          functionSchema: 'public',
          functionName: 'compute_full_name',
        }}
      />,
    );

    expect(screen.getByLabelText('Computed Field Name')).toBeDisabled();
    expect(
      screen.getByText(/name of an existing computed field cannot be changed/i),
    ).toBeInTheDocument();
  });

  it('disables the function combobox until a schema is selected', () => {
    render(<TestWrapper mode="create" />);

    const functionCombobox = screen.getByRole('combobox', {
      name: 'Function Name',
    });
    expect(functionCombobox).toBeDisabled();
    expect(functionCombobox).toHaveTextContent('Select a schema first');
  });

  it('enables the function combobox once a schema is selected', () => {
    render(
      <TestWrapper
        mode="create"
        defaultValues={{ functionSchema: 'public' }}
      />,
    );

    const functionCombobox = screen.getByRole('combobox', {
      name: 'Function Name',
    });
    expect(functionCombobox).not.toBeDisabled();
    expect(functionCombobox).toHaveTextContent('Select a function');
  });

  it('renders all six fields with their labels', () => {
    render(<TestWrapper mode="create" />);

    expect(screen.getByLabelText('Computed Field Name')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Function Schema' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Function Name' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Table Row Argument')).toBeInTheDocument();
    expect(screen.getByLabelText('Session Argument')).toBeInTheDocument();
    expect(screen.getByLabelText('Comment')).toBeInTheDocument();
  });

  it('shows the function reference in the comment placeholder when both schema and function are set', () => {
    render(
      <TestWrapper
        mode="edit"
        defaultValues={{
          name: 'full_name',
          functionSchema: 'public',
          functionName: 'compute_full_name',
        }}
      />,
    );

    expect(screen.getByLabelText('Comment')).toHaveAttribute(
      'placeholder',
      'A computed field, executes function public.compute_full_name',
    );
  });

  it('clears the function name when the schema changes to one that does not contain it', async () => {
    const formRef: TestWrapperProps['formRef'] = { current: null };

    render(
      <TestWrapper
        mode="edit"
        defaultValues={{
          name: 'full_name',
          functionSchema: 'public',
          functionName: 'compute_full_name',
        }}
        formRef={formRef}
      />,
    );

    expect(formRef.current?.getValues('functionName')).toBe(
      'compute_full_name',
    );

    await act(async () => {
      formRef.current!.setValue('functionSchema', 'analytics');
    });

    expect(formRef.current?.getValues('functionName')).toBe('');
  });

  it('disables every field when the disabled prop is set', () => {
    render(
      <TestWrapper
        mode="create"
        disabled
        defaultValues={{ functionSchema: 'public' }}
      />,
    );

    expect(screen.getByLabelText('Computed Field Name')).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Function Schema' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Function Name' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Table Row Argument')).toBeDisabled();
    expect(screen.getByLabelText('Session Argument')).toBeDisabled();
    expect(screen.getByLabelText('Comment')).toBeDisabled();
  });
});
