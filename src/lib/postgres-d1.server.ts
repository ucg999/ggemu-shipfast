import postgres, { type Sql } from 'postgres'

type QueryRow = Record<string, unknown>

export type DatabaseStatement = {
  bind: (...values: unknown[]) => DatabaseStatement
  first: <T = QueryRow>() => Promise<T | null>
  all: <T = QueryRow>() => Promise<{ results: T[] }>
  run: () => Promise<{ success: boolean; meta: { changes: number; last_row_id?: number } }>
}

export type DatabaseLike = {
  prepare: (query: string) => DatabaseStatement
  batch: (statements: DatabaseStatement[]) => Promise<Array<{ success: boolean; meta: { changes: number; last_row_id?: number } }>>
}

export function postgresDatabase(connectionString: string): DatabaseLike {
  return {
    prepare(query) {
      return createStatement(connectionString, query)
    },
    async batch(statements) {
      const client = createClient(connectionString)
      try {
        return await client.begin(async transaction => {
          const results = []
          for (const statement of statements as PostgresStatement[]) {
            results.push(await statement.execute(transaction))
          }
          return results
        })
      } finally {
        await client.end({ timeout: 1 })
      }
    },
  }
}

type PostgresStatement = DatabaseStatement & {
  execute: (sql: Sql) => Promise<{ success: boolean; meta: { changes: number; last_row_id?: number } }>
}

function createClient(connectionString: string) {
  const throughHyperdrive = connectionString.includes('.hyperdrive.local')
  return postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    fetch_types: false,
    ...(throughHyperdrive ? {} : { ssl: 'require' as const }),
  })
}

async function withClient<T>(connectionString: string, operation: (client: Sql) => Promise<T>) {
  const client = createClient(connectionString)
  try {
    return await operation(client)
  } finally {
    await client.end({ timeout: 1 })
  }
}

function createStatement(connectionString: string, source: string, values: unknown[] = []): PostgresStatement {
  const statement: PostgresStatement = {
    bind(...nextValues) {
      return createStatement(connectionString, source, nextValues)
    },
    async first<T>() {
      const rows = await withClient(connectionString, client => executeRows(client, source, values))
      return (rows[0] as T | undefined) ?? null
    },
    async all<T>() {
      const rows = await withClient(connectionString, client => executeRows(client, source, values))
      return { results: rows as T[] }
    },
    async run() {
      return withClient(connectionString, client => statement.execute(client))
    },
    async execute(executor) {
      const rows = await executeRows(executor, source, values)
      return {
        success: true,
        meta: {
          changes: rows.count,
          ...(typeof rows[0]?.id === 'number' ? { last_row_id: rows[0].id } : {}),
        },
      }
    },
  }
  return statement
}

async function executeRows(sql: Sql, source: string, values: unknown[]) {
  const query = translateSql(source)
  try {
    const rows = await sql.unsafe(query, values.map(normalizeParameter))
    for (const row of rows) normalizeRow(row as QueryRow)
    return rows
  } catch (error) {
    console.error('Supabase query failed', {
      query: query.replace(/\s+/g, ' ').slice(0, 240),
      message: error instanceof Error ? error.message : String(error),
      code: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
    })
    throw error
  }
}

function translateSql(source: string) {
  let query = source.trim().replace(/;\s*$/, '')
  if (/^insert\s+into\s+member_number_sequence\s+default\s+values$/i.test(query)) {
    return `SELECT nextval('member_number_sequence')::integer AS id`
  }
  const ignoreConflict = /^insert\s+or\s+ignore\s+/i.test(query)
  query = query
    .replace(/^insert\s+or\s+ignore\s+/i, 'INSERT ')
    .replace(/datetime\('now',\s*'-30 minutes'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '30 minutes'")
    .replace(/datetime\('now',\s*'-15 minutes'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '15 minutes'")
    .replace(/datetime\('now',\s*'-1 year'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '1 year'")
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/MAX\(score,\s*excluded\.score\)/gi, 'GREATEST(score, excluded.score)')

  let parameter = 0
  query = query.replace(/\?/g, () => `$${++parameter}`)
  if (ignoreConflict && !/\bon\s+conflict\b/i.test(query)) query += ' ON CONFLICT DO NOTHING'
  return query
}

function normalizeParameter(value: unknown) {
  return value === undefined ? null : value
}

function normalizeRow(row: QueryRow) {
  for (const [key, value] of Object.entries(row)) {
    if ((key.endsWith('_json') || key === 'bets_json') && value !== null && typeof value === 'object') {
      row[key] = JSON.stringify(value)
    } else if (value instanceof Date) {
      const iso = value.toISOString()
      row[key] = key === 'today' || key.endsWith('_date') ? iso.slice(0, 10) : iso.replace('T', ' ').replace('Z', '')
    } else if (typeof value === 'string' && (key === 'coins_gained' || key.endsWith('_at_ms'))) {
      row[key] = Number(value)
    }
  }
}
