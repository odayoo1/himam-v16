import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { q } from '../db.js';

const router = Router();
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  const { rows } = await q(`SELECT id, username, password_hash, full_name, phone, whatsapp, role, path_id, avatar FROM users WHERE LOWER(username)=LOWER($1)`, [username.trim()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
  delete user.password_hash;
  res.json({ token, user });
});


router.post('/register', async (req,res)=>{
  const { fullName, username, password, phone='', pathId='p1', avatar=null } = req.body || {};
  if (!fullName || !username || !password || !pathId) return res.status(400).json({error:'البيانات الأساسية ناقصة'});
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({error:'اسم المستخدم غير صالح'});
  if (password.length < 4) return res.status(400).json({error:'كلمة المرور قصيرة'});
  const exists=(await q('SELECT 1 FROM users WHERE LOWER(username)=LOWER($1)',[username.trim()])).rowCount;
  if(exists) return res.status(409).json({error:'اسم المستخدم موجود مسبقا'});
  const id='s'+Date.now();
  const hash=await bcrypt.hash(password,12);
  const {rows} = await q(`INSERT INTO users(id,username,password_hash,full_name,phone,role,path_id,avatar) VALUES($1,$2,$3,$4,$5,'student',$6,$7) RETURNING id,username,full_name,phone,whatsapp,role,path_id,avatar`,[id,username.trim(),hash,fullName.trim(),phone,pathId,avatar]);
  const user=rows[0];
  const token=jwt.sign({sub:user.id,role:user.role},process.env.JWT_SECRET,{expiresIn:'30d'});
  res.status(201).json({token,user});
});

router.get('/me', async (req, res) => res.status(401).json({ error: 'استخدم Bearer token' }));
export default router;
