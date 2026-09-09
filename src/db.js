import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10
});

export const q = (text, params = []) => pool.query(text, params);
