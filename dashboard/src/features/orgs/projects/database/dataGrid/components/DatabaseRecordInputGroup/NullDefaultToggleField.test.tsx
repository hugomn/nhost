import { FormProvider, useForm } from 'react-hook-form';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import NullDefaultToggleField from './NullDefaultToggleField';

function Wrapper({
  defaultValue = POSTGRES_DEFAULT_PLACEHOLDER,
}: {
  defaultValue?: string | null;
}) {
  const methods = useForm({ defaultValues: { col: defaultValue } });
  return (
    <FormProvider {...methods}>
      <NullDefaultToggleField
        control={methods.control}
        name="col"
        label="Column"
      />
    </FormProvider>
  );
}

describe('NullDefaultToggleField', () => {
  it('shows "Set to NULL" button when field has a value', () => {
    render(<Wrapper defaultValue={POSTGRES_DEFAULT_PLACEHOLDER} />);
    expect(
      screen.getByRole('button', { name: /set to null/i }),
    ).toBeInTheDocument();
  });

  it('shows "Set to DEFAULT" button when field is null', () => {
    render(<Wrapper defaultValue={null} />);
    expect(
      screen.getByRole('button', { name: /set to default/i }),
    ).toBeInTheDocument();
  });

  it('disables the input after clicking "Set to NULL"', async () => {
    render(<Wrapper />);
    await new TestUserEvent().click(
      screen.getByRole('button', { name: /set to null/i }),
    );
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('re-enables the input after clicking "Set to DEFAULT"', async () => {
    render(<Wrapper defaultValue={null} />);
    await new TestUserEvent().click(
      screen.getByRole('button', { name: /set to default/i }),
    );
    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });
});
