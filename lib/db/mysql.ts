// lib/mysql.ts — DB connection layer
import 'server-only';
import mysql from 'mysql2/promise';
import { env } from '@/lib/db/env';

const globalForDb = globalThis as unknown as {
  pool?: mysql.Pool;
};

export const pool =
  globalForDb.pool ??
  mysql.createPool({
    uri: env.databaseUrl,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    charset: 'utf8mb4',
    dateStrings: true, // DATETIME / DATE 一律回傳字串，避免時區轉換
  });

if (env.nodeEnv !== 'production') {
  globalForDb.pool = pool; // 開發 HMR 重用同一個 pool
}

export type Connection = mysql.PoolConnection;

/** 在單一 transaction 內執行；失敗自動 rollback。 */
export async function withTransaction<T>(
  fn: (conn: Connection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
