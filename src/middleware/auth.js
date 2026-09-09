import jwt from 'jsonwebtoken';
import { q } from '../db.js';

export async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'غير مصرح' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await q(`SELECT id, username, full_name, phone, whatsapp, role, path_id, avatar FROM users WHERE id=$1`, [payload.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'المستخدم غير موجود' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'جلسة الدخول غير صالحة' });
  }
}

export const roles = (...allowed) => (req, res, next) => {
  if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'ليس لديك صلاحية' });
  next();
};

export function canAccessStudent(req, studentId) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'student') return req.user.id === studentId;
  return false;
}

export async function canAccessByPath(req, studentId) {
  if (req.user.role === 'admin') return true;
  const { rows } = await q('SELECT path_id FROM users WHERE id=$1 AND role=\'student\'', [studentId]);
  return !!rows[0] && req.user.role === 'moshref' && rows[0].path_id === req.user.path_id;
}
