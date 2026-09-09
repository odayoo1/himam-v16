CREATE TABLE IF NOT EXISTS paths (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','moshref','student')),
  path_id TEXT REFERENCES paths(id) ON DELETE SET NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  surah TEXT NOT NULL,
  from_aya INTEGER NOT NULL,
  to_aya INTEGER NOT NULL,
  wujuh NUMERIC(5,1) NOT NULL CHECK (wujuh >= 0.5)
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  surah TEXT NOT NULL,
  grade TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  moshref_name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_student_date ON records(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_exams_student_date ON exams(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_users_role_path ON users(role, path_id);

INSERT INTO paths (id,name,description,color) VALUES
('p1','أخذها بركة','حفظ سورة البقرة كاملة - بركة في البيت والرزق','from-emerald-700 to-emerald-500'),
('p2','ربع يس','من سورة يس إلى الناس - قلب القرآن وما بعده','from-amber-700 to-amber-500'),
('p3','جزئي عم وتبارك','جزء عم وجزء تبارك - بداية الحفظ المتين','from-teal-700 to-teal-500'),
('p4','قصار المفصل','من الضحى إلى الناس - للصغار والمبتدئين','from-yellow-700 to-yellow-600')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, color=EXCLUDED.color;
