import { act } from 'react';
import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form';
import { afterEach, vi } from 'vitest';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';
import ComputedFieldFormFields from './ComputedFieldFormFields';
import {
  type ComputedFieldFormValues,
  defaultComputedFieldValues,
} from './computedFieldFormTypes';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

mockPointerEvent();

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: {
      orgSlug: 'test-org',
      appSubdomain: 'test-project',
      dataSourceSlug: 'default',
    },
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const TABLE: QualifiedTable = { name: 'users', schema: 'public' };

const usersRowArg = { schema: 'public', name: 'users', type: 'c' };

const FUNCTIONS: PostgresFunction[] = [
  {
    function_schema: 'public',
    function_name: 'compute_full_name',
    function_arguments: 'row public.users',
    input_arg_types: [usersRowArg],
  },
  {
    function_schema: 'public',
    function_name: 'calculate_age',
    function_arguments: 'row public.users',
    input_arg_types: [usersRowArg],
  },
  {
    function_schema: 'analytics',
    function_name: 'lifetime_value',
    function_arguments: 'row public.users',
    input_arg_types: [usersRowArg],
  },
];

interface TestWrapperProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<ComputedFieldFormValues>;
  functions?: PostgresFunction[];
  table?: QualifiedTable;
  isFunctionsLoading?: boolean;
  disabled?: boolean;
  formRef?: { current: UseFormReturn<ComputedFieldFormValues> | null };
}

function TestWrapper({
  mode,
  defaultValues,
  functions = FUNCTIONS,
  table = TABLE,
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
        table={table}
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

  it('renders the New Function action when the function combobox is opened', async () => {
    const user = new TestUserEvent();
    render(
      <TestWrapper
        mode="create"
        defaultValues={{ functionSchema: 'public' }}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Function Name' }));

    expect(
      await screen.findByTestId('computed-field-new-function-action'),
    ).toBeInTheDocument();
  });

  it('opens the SQL editor in a new tab with a CREATE FUNCTION template when New Function is clicked', async () => {
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null as unknown as Window);
    const user = new TestUserEvent();

    render(
      <TestWrapper
        mode="create"
        defaultValues={{ functionSchema: 'public' }}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Function Name' }));
    await user.click(
      await screen.findByTestId('computed-field-new-function-action'),
    );

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, target, features] = openSpy.mock.calls[0];
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
    expect(String(calledUrl)).toMatch(
      /^\/orgs\/test-org\/projects\/test-project\/database\/browser\/default\/editor\?sql=/,
    );

    const decodedSql = decodeURIComponent(
      String(calledUrl).split('?sql=')[1] ?? '',
    );
    expect(decodedSql).toContain(
      'CREATE OR REPLACE FUNCTION public.my_computed_field(row public.users)',
    );
  });

  it('uses the table schema in the SQL template when the function schema differs', async () => {
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null as unknown as Window);
    const user = new TestUserEvent();

    render(
      <TestWrapper
        mode="create"
        table={{ name: 'users', schema: 'public' }}
        defaultValues={{ functionSchema: 'analytics' }}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Function Name' }));
    await user.click(
      await screen.findByTestId('computed-field-new-function-action'),
    );

    const calledUrl = String(openSpy.mock.calls[0][0]);
    const decodedSql = decodeURIComponent(calledUrl.split('?sql=')[1] ?? '');
    expect(decodedSql).toContain(
      'CREATE OR REPLACE FUNCTION analytics.my_computed_field(row public.users)',
    );
  });
});
