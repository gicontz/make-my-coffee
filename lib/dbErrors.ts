// Pure Postgres error checks. No db import, so tests can load it without a
// connection string.

// SQLSTATE 42703 undefined_column: the code is newer than the schema. Every
// deploy here can race its own migration (develop deploys straight to
// production and migrations are applied by hand), so a route that can answer
// correctly without a new column checks this rather than returning a 500.
export function isUndefinedColumn(err: unknown, column?: string): boolean {
  if (!err || typeof err !== 'object') return false
  const { code, message } = err as { code?: unknown; message?: unknown }
  if (code !== '42703') return false
  return column === undefined || (typeof message === 'string' && message.includes(`"${column}"`))
}

// SQLSTATE 42P01 undefined_table: same race as above, for a route whose whole
// table arrives with a migration. Nothing to fall back to, so the caller turns
// it into a message that names the migration rather than a bare 500.
export function isUndefinedTable(err: unknown, table?: string): boolean {
  if (!err || typeof err !== 'object') return false
  const { code, message } = err as { code?: unknown; message?: unknown }
  if (code !== '42P01') return false
  return table === undefined || (typeof message === 'string' && message.includes(`"${table}"`))
}
