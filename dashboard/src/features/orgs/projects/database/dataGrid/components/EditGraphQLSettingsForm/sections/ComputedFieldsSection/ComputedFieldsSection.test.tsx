import { delay, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen, waitFor } from '@/tests/testUtils';
import type { ComputedFieldItem } from '@/utils/hasura-api/generated/schemas';
import ComputedFieldsSection from './ComputedFieldsSection';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const HASURA_URL = 'https://local.hasura.local.nhost.run';

interface ExportMetadataHandlerOptions {
  computedFields?: ComputedFieldItem[];
  delayMs?: number | 'infinite';
  errorMessage?: string;
}

function exportMetadataHandler({
  computedFields,
  delayMs,
  errorMessage,
}: ExportMetadataHandlerOptions = {}) {
  return http.post(`${HASURA_URL}/v1/metadata`, async () => {
    if (delayMs !== undefined) {
      await delay(delayMs);
    }
    if (errorMessage) {
      return HttpResponse.json(
        { error: errorMessage, code: 'unexpected' },
        { status: 500 },
      );
    }
    const tableEntry: Record<string, unknown> = {
      table: { name: 'users', schema: 'public' },
    };
    if (computedFields) {
      tableEntry.computed_fields = computedFields;
    }
    return HttpResponse.json({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [{ name: 'default', kind: 'postgres', tables: [tableEntry] }],
      },
    });
  });
}

interface V2QueryHandlerOptions {
  functions?: PostgresFunction[];
  schemas?: string[];
  functionsErrorMessage?: string;
  schemasErrorMessage?: string;
}

function v2QueryHandler({
  functions = [],
  schemas = ['public'],
  functionsErrorMessage,
  schemasErrorMessage,
}: V2QueryHandlerOptions = {}) {
  return http.post(`${HASURA_URL}/v2/query`, async ({ request }) => {
    const body = (await request.json()) as {
      args: Array<{ args: { sql: string } }>;
    };
    const firstSql = body.args[0]?.args?.sql ?? '';

    // fetchPostgresFunctions sends a single bulk arg with pg_get_functiondef
    if (body.args.length === 1 && firstSql.includes('pg_get_functiondef')) {
      if (functionsErrorMessage) {
        return HttpResponse.json(
          {
            error: functionsErrorMessage,
            code: 'unexpected',
            internal: { error: { message: functionsErrorMessage } },
          },
          { status: 500 },
        );
      }
      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [['data'], ...functions.map((fn) => [JSON.stringify(fn)])],
        },
      ]);
    }

    // fetchDatabase sends three bulk args (schemas, tables, functions)
    if (body.args.length === 3) {
      if (schemasErrorMessage) {
        return HttpResponse.json(
          {
            error: schemasErrorMessage,
            code: 'unexpected',
            internal: { error: { message: schemasErrorMessage } },
          },
          { status: 500 },
        );
      }
      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [
            ['data'],
            ...schemas.map((name) => [JSON.stringify({ schema_name: name })]),
          ],
        },
        { result_type: 'TuplesOk', result: [['data']] },
        { result_type: 'TuplesOk', result: [['data']] },
      ]);
    }

    return HttpResponse.json(
      { error: 'Unhandled v2/query body', code: 'unexpected' },
      { status: 500 },
    );
  });
}

const sampleFunctions: PostgresFunction[] = [
  {
    function_schema: 'public',
    function_name: 'compute_full_name',
    function_arguments: 'row public.users',
    function_definition:
      'CREATE OR REPLACE FUNCTION public.compute_full_name(row public.users) RETURNS text LANGUAGE sql STABLE AS $$ SELECT row.first_name $$;',
    input_arg_types: [{ schema: 'public', name: 'users', type: 'c' }],
  },
  {
    function_schema: 'public',
    function_name: 'calculate_age',
    function_arguments: 'row public.users',
    function_definition:
      'CREATE OR REPLACE FUNCTION public.calculate_age(row public.users) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT 0 $$;',
    input_arg_types: [{ schema: 'public', name: 'users', type: 'c' }],
  },
];

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

const server = setupServer(
  tokenQuery,
  getProjectQuery,
  exportMetadataHandler(),
  v2QueryHandler({ functions: sampleFunctions, schemas: ['public', 'auth'] }),
);

describe('ComputedFieldsSection', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
    server.listen({ onUnhandledRequest: 'warn' });
  });

  beforeEach(() => {
    mocks.useRouter.mockReturnValue({
      ...mockRouter,
      query: { ...mockRouter.query, dataSourceSlug: 'default' },
    });
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
  });

  afterAll(() => {
    server.close();
  });

  it('shows the loading skeleton while computed fields are loading', async () => {
    server.use(exportMetadataHandler({ delayMs: 'infinite' }));

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(screen.getByText('Computed Fields')).toBeInTheDocument();
    // Skeleton render: empty-state copy and the add stub are absent.
    expect(
      screen.queryByText('No computed fields configured.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('add-computed-field-stub'),
    ).not.toBeInTheDocument();
  });

  it('renders the empty state and the add stub when no computed fields exist', async () => {
    server.use(exportMetadataHandler({ computedFields: [] }));

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(
      await screen.findByText('No computed fields configured.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-computed-field-stub')).toBeInTheDocument();
  });

  it('renders one row per computed field with name, function, and comment', async () => {
    server.use(exportMetadataHandler({ computedFields: sampleComputedFields }));

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(await screen.findByText('full_name')).toBeInTheDocument();
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

  it('shows a message and hides the list when the table is untracked', async () => {
    render(
      <ComputedFieldsSection schema="public" tableName="users" isUntracked />,
    );

    expect(
      await screen.findByText(
        'Track this table to manage its computed fields.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No computed fields configured.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('add-computed-field-stub'),
    ).not.toBeInTheDocument();
  });

  it('shows an alert when computed fields fail to load', async () => {
    server.use(exportMetadataHandler({ errorMessage: 'Metadata down' }));

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(
      await screen.findByText('Unable to load computed fields'),
    ).toBeInTheDocument();
    expect(screen.getByText('Metadata down')).toBeInTheDocument();
    expect(
      screen.queryByTestId('add-computed-field-stub'),
    ).not.toBeInTheDocument();
  });

  it('shows a separate alert when the available functions fail to load', async () => {
    server.use(
      exportMetadataHandler({ computedFields: [] }),
      v2QueryHandler({
        schemas: ['public'],
        functionsErrorMessage: 'SQL connection refused',
      }),
    );

    render(<ComputedFieldsSection schema="public" tableName="users" />);

    expect(
      await screen.findByText('Unable to load available functions'),
    ).toBeInTheDocument();
    expect(screen.getByText('SQL connection refused')).toBeInTheDocument();
    // The stub stays visible — the failure is scoped to functions, not metadata.
    await waitFor(() => {
      expect(screen.getByTestId('add-computed-field-stub')).toBeInTheDocument();
    });
  });
});
