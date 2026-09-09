import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } });

try {
  const schema = await fs.readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  const hash = await bcrypt.hash('admin123', 12);
  await pool.query(`
    INSERT INTO users (id, username, password_hash, full_name, phone, role, path_id)
    VALUES ('admin1','admin',$1,'الإدارة العامة','0910000000','admin','p1')
    ON CONFLICT (username) DO NOTHING
  `, [hash]);
  console.log('Database initialized. Default admin: admin / admin123');
} finally {
  await pool.end();
}
