import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  globalThis.__sql ??
  postgres(process.env.DATABASE_URL ?? 'postgres://syllig:syllig@localhost:5432/syllig', {
    max: 10,
    onnotice: () => {},
    transform: { undefined: null },
  });
if (process.env.NODE_ENV !== 'production') globalThis.__sql = sql;
