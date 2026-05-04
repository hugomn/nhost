import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';
import type { ComputedFieldItem } from '@/utils/hasura-api/generated/schemas';
import ComputedFieldsSection from './ComputedFieldsSection';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  useTableComputedFieldsQuery: vi.fn(),
  usePostgresFunctionsQuery: vi.fn(),
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTableComputedFieldsQuery',
  () => ({
    useTableComputedFieldsQuery: mocks.useTableComputedFieldsQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery',
  () => ({
    usePostgresFunctionsQuery: mocks.usePostgresFunctionsQuery,
  }),
);

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    __esModule: true,
    default: mocks.useGetMetadataResourceVersion,
    useGetMetadataResourceVersion: mocks.useGetMetadataResourceVersion,
  }),
);

const sampleComputedFields: ComputedFieldItem[] = [
  {
    name: 'full_name',
    definition: {
      function: { schema: 'public', name: 'compute_full_name' },
      table_argument: 'oracle_row',
    },
    comment: 'Concatenates first and last name',
  },
  {
    name: 'age',
    definition: {
      function: { schema: 'public', name: 'calculate_age' },
    },
  },
];

beforeEach(() => {
  mocks.useProject.mockReturnValue({
    project: {
      subdomain: 'test-project',
      region: { name: 'local' },
      config: { hasura: { adminSecret: 'nhost-admin-secret' } },
    },
    loading: false,
  });
  mocks.useIsPlatform.mockReturnValue(false);
  mocks.useGetMetadataResourceVersion.mockReturnValue({
    data: 1,
    refetch: vi.fn().mockResolvedValue({ data: 1 }),
  });
  mocks.usePostgresFunctionsQuery.mockReturnValue({
    data: {
      functions: [
        {
          function_schema: 'public',
          function_name: 'compute_full_name',
          function_arguments: 'row public.users',
          input_arg_types: [{ schema: 'public', name: 'users', type: 'c' }],
        },
        {
          function_schema: 'public',
          function_name: 'calculate_age',
          function_arguments: 'row public.users',
          input_arg_types: [{ schema: 'public', name: 'users', type: 'c' }],
        },
      ],
    },
    isLoading: false,
    error: null,
    isError: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ComputedFieldsSection', () => {
  it('shows the loading skeleton while computed fields are loading', () => {
    mocks.useTableComputedFieldsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    });

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(screen.getByText('Computed Fields')).toBeInTheDocument();
    expect(
      screen.queryByText('No computed fields configured.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('add-computed-field-stub'),
    ).not.toBeInTheDocument();
  });

  it('renders the empty state and the add stub when no computed fields exist', () => {
    mocks.useTableComputedFieldsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isError: false,
    });

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(
      screen.getByText('No computed fields configured.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-computed-field-stub')).toBeInTheDocument();
  });

  it('renders one row per computed field with name, function, and comment', () => {
    mocks.useTableComputedFieldsQuery.mockReturnValue({
      data: sampleComputedFields,
      isLoading: false,
      error: null,
      isError: false,
    });

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(screen.getByText('full_name')).toBeInTheDocument();
    expect(screen.getByText('public.compute_full_name')).toBeInTheDocument();
    expect(
      screen.getByText('Concatenates first and last name'),
    ).toBeInTheDocument();

    expect(screen.getByText('age')).toBeInTheDocument();
    expect(screen.getByText('public.calculate_age')).toBeInTheDocument();

    expect(
      screen.getByTestId('edit-computed-field-full_name'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('delete-computed-field-full_name'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('edit-computed-field-age')).toBeInTheDocument();
    expect(screen.getByTestId('delete-computed-field-age')).toBeInTheDocument();

    expect(screen.getByTestId('add-computed-field-stub')).toBeInTheDocument();
  });

  it('shows a message and hides the list when the table is untracked', () => {
    mocks.useTableComputedFieldsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isError: false,
    });

    render(
      <ComputedFieldsSection schema="public" tableName="users" isUntracked />,
    );

    expect(
      screen.getByText('Track this table to manage its computed fields.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No computed fields configured.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('add-computed-field-stub'),
    ).not.toBeInTheDocument();
  });

  it('shows an alert when computed fields fail to load', () => {
    mocks.useTableComputedFieldsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Metadata down'),
      isError: true,
    });

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(
      screen.getByText('Unable to load computed fields'),
    ).toBeInTheDocument();
    expect(screen.getByText('Metadata down')).toBeInTheDocument();
    expect(
      screen.queryByTestId('add-computed-field-stub'),
    ).not.toBeInTheDocument();
  });

  it('shows a separate alert when the available functions fail to load', () => {
    mocks.useTableComputedFieldsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isError: false,
    });
    mocks.usePostgresFunctionsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('SQL connection refused'),
      isError: true,
    });

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(
      screen.getByText('Unable to load available functions'),
    ).toBeInTheDocument();
    expect(screen.getByText('SQL connection refused')).toBeInTheDocument();
    // The stub is still shown so users can see the section is otherwise healthy.
    expect(screen.getByTestId('add-computed-field-stub')).toBeInTheDocument();
  });
});
