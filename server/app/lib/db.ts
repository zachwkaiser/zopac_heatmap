import postgres from 'postgres';

// Singleton database connection pool
// Reused across all requests to avoid exhausting 256MB database
let sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!sql) {
    console.log('[DB] Creating new database connection pool');
    sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
      max: 3, // Small pool for 256MB database
      idle_timeout: 30,
      connect_timeout: 15,
      max_lifetime: 300, // 5 minutes max connection lifetime
      onnotice: () => {}, // Suppress notices
    });
  }
  return sql;
}

// Export function to reset connection (useful for error recovery)
export function resetDb() {
  if (sql) {
    console.log('[DB] Resetting database connection pool');
    sql.end({ timeout: 5 }).catch(console.error);
    sql = null;
  }
}
