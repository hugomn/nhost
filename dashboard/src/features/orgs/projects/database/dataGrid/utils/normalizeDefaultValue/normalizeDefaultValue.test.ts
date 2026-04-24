import normalizeDefaultValue from './normalizeDefaultValue';

it('should return null if no default value', () => {
  expect(normalizeDefaultValue(null)).toMatchObject({
    normalizedDefaultValue: null,
    custom: false,
  });
  expect(normalizeDefaultValue('')).toMatchObject({
    normalizedDefaultValue: null,
    custom: false,
  });
});

it('should not change default value that is a plain string', () => {
  expect(normalizeDefaultValue('test')).toMatchObject({
    normalizedDefaultValue: 'test',
    custom: false,
  });
});

it('should preserve empty-string casts so the form can pre-select them', () => {
  expect(normalizeDefaultValue("''::text")).toMatchObject({
    normalizedDefaultValue: "''::text",
    custom: false,
  });

  expect(normalizeDefaultValue("''::character varying")).toMatchObject({
    normalizedDefaultValue: "''::character varying",
    custom: false,
  });
});

it('should remove apostrophes and type definition from default value', () => {
  expect(normalizeDefaultValue("'Test Value'::text")).toMatchObject({
    normalizedDefaultValue: 'Test Value',
    custom: true,
  });

  expect(
    normalizeDefaultValue("'Test Value'::character varying"),
  ).toMatchObject({
    normalizedDefaultValue: 'Test Value',
    custom: true,
  });

  expect(normalizeDefaultValue("'3'::int4")).toMatchObject({
    normalizedDefaultValue: '3',
    custom: true,
  });
});

it('should remove arguments from default value function string if enabled', () => {
  expect(
    normalizeDefaultValue("nextval('test_table_seq')", { removeArgs: true }),
  ).toMatchObject({
    normalizedDefaultValue: 'nextval()',
    custom: false,
  });

  expect(
    normalizeDefaultValue("function('args', 'args')", { removeArgs: true }),
  ).toMatchObject({
    normalizedDefaultValue: 'function()',
    custom: false,
  });
});
