```js
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

try {
  // قراءة مخطط قاعدة البيانات
  const schema = await fs.readFile(
    new URL('../db/schema.sql', import.meta.url),
    'utf8'
  );

  // إنشاء الجداول
  await pool.query(schema);

  // =========================
  // المستخدم الأول
  // =========================
  const adminHash = await bcrypt.hash('admin123', 12);

  await pool.query(
    `
    INSERT INTO users (
      id,
      username,
      password_hash,
      full_name,
      phone,
      role,
      path_id
    )
    VALUES (
      'admin1',
      'admin',
      $1,
      'الإدارة العامة',
      '0914188683',
      'admin',
      'p1'
    )
    ON CONFLICT (username) DO NOTHING
    `,
    [adminHash]
  );

  // =========================
  // المستخدم الثاني
  // =========================
  const generalHash = await bcrypt.hash('otmf1013', 12);

  await pool.query(
    `
    INSERT INTO users (
      id,
      username,
      password_hash,
      full_name,
      phone,
      role,
      path_id
    )
    VALUES (
      'admin2',
      'general',
      $1,
      'المشرف العام',
      '',
      'admin',
      'p1'
    )
    ON CONFLICT (username) DO NOTHING
    `,
    [generalHash]
  );

  console.log('Database initialized successfully.');
  console.log('Admin 1: admin / admin123');
  console.log('Admin 2: general / otmf1013');

} catch (error) {
  console.error('Database initialization failed:', error);
  process.exitCode = 1;

} finally {
  await pool.end();
}
```
