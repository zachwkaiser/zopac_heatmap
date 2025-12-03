import postgres from 'postgres';

// Singleton database connection pool
// Reused across all requests to avoid exhausting 256MB database
let sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!sql) {
    sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
      max: 2, // Very small pool for 256MB database
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return sql;
}
