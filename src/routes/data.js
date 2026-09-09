import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { auth, roles, canAccessStudent, canAccessByPath } from '../middleware/auth.js';

const router = Router();
router.use(auth);

const publicUser = r => ({ id:r.id, username:r.username, fullName:r.full_name, phone:r.phone, whatsapp:r.whatsapp, role:r.role, pathId:r.path_id, avatar:r.avatar });
const recordOut = r => ({ id:r.id, studentId:r.student_id, date:r.date, type:r.type, surah:r.surah, fromAya:r.from_aya, toAya:r.to_aya, wujuh:Number(r.wujuh) });
const examOut = r => ({ id:r.id, studentId:r.student_id, date:r.date, surah:r.surah, grade:r.grade, notes:r.notes, moshrefName:r.moshref_name });

router.get('/bootstrap', async (req,res) => {
  const paths = (await q('SELECT id,name,description,color FROM paths ORDER BY id')).rows;
  let users;
  if (req.user.role === 'admin') users = (await q('SELECT * FROM users ORDER BY created_at')).rows;
  else if (req.user.role === 'moshref') users = (await q('SELECT * FROM users WHERE role IN (\'moshref\',\'student\') AND (id=$1 OR path_id=$2) ORDER BY created_at',[req.user.id,req.user.path_id])).rows;
  else users = (await q('SELECT * FROM users WHERE id=$1',[req.user.id])).rows;
  const ids = users.filter(u=>u.role==='student').map(u=>u.id);
  const records = ids.length ? (await q('SELECT * FROM records WHERE student_id = ANY($1) ORDER BY date DESC',[ids])).rows.map(recordOut) : [];
  const exams = ids.length ? (await q('SELECT * FROM exams WHERE student_id = ANY($1) ORDER BY date DESC',[ids])).rows.map(examOut) : [];
  const setting = (await q('SELECT value FROM settings WHERE key=\'header\'')).rows[0]?.value || null;
 res.json({ user:publicUser(req.user), users:users.map(publicUser), records, exams, paths, header:setting });
});

router.get('/paths', async (_,res)=>res.json({ paths:(await q('SELECT id,name,description,color FROM paths ORDER BY id')).rows }));
router.get('/users', roles('admin','moshref'), async (req,res)=>{
  const rows = req.user.role==='admin' ? (await q('SELECT * FROM users ORDER BY created_at')).rows : (await q('SELECT * FROM users WHERE role IN (\'moshref\',\'student\') AND path_id=$1 ORDER BY created_at',[req.user.path_id])).rows;
  res.json({ users:rows.map(publicUser) });
});

router.post('/users', roles('admin'), async (req,res)=>{
  const { fullName, username, password, phone='', pathId='p1', avatar=null, role='student' } = req.body || {};
  if (!fullName || !username || !password) return res.status(400).json({error:'البيانات الأساسية ناقصة'});
  if (!['student','moshref'].includes(role)) return res.status(400).json({error:'الدور غير صالح'});
  if (password.length < 4) return res.status(400).json({error:'كلمة المرور قصيرة'});
  const exists=(await q('SELECT 1 FROM users WHERE LOWER(username)=LOWER($1)',[username])).rowCount;
  if(exists) return res.status(409).json({error:'اسم المستخدم موجود مسبقا'});
  const id=(role==='student'?'s':'m')+Date.now();
  const hash=await bcrypt.hash(password,12);
  const {rows} = await q(`INSERT INTO users(id,username,password_hash,full_name,phone,role,path_id,avatar) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[id,username,hash,fullName,phone,role,pathId,avatar]);
  res.status(201).json({user:publicUser(rows[0])});
});

router.patch('/users/:id', roles('admin'), async (req,res)=>{
  const { phone, whatsapp, fullName, pathId, avatar }=req.body||{};
  const {rows}=await q(`UPDATE users SET phone=COALESCE($1,phone), whatsapp=COALESCE($2,whatsapp), full_name=COALESCE($3,full_name), path_id=COALESCE($4,path_id), avatar=COALESCE($5,avatar) WHERE id=$6 RETURNING *`,[phone,whatsapp,fullName,pathId,avatar,req.params.id]);
  if(!rows[0]) return res.status(404).json({error:'المستخدم غير موجود'});
  res.json({user:publicUser(rows[0])});
});

router.patch('/users/:id/password', roles('admin'), async (req,res)=>{
  const {password}=req.body||{};
  if(!password || password.length<4) return res.status(400).json({error:'كلمة المرور قصيرة'});
  const hash=await bcrypt.hash(password,12);
  const {rowCount}=await q('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,req.params.id]);
  if(!rowCount) return res.status(404).json({error:'المستخدم غير موجود'});
  res.json({ok:true});
});

router.patch('/me/password', async (req,res)=>{
  const {currentPassword,newPassword}=req.body||{};
  if(!currentPassword || !newPassword || newPassword.length<4) return res.status(400).json({error:'بيانات كلمة المرور غير صحيحة'});
  const {rows}=await q('SELECT password_hash FROM users WHERE id=$1',[req.user.id]);
  if(!rows[0] || !(await bcrypt.compare(currentPassword,rows[0].password_hash))) return res.status(400).json({error:'كلمة المرور الحالية غير صحيحة'});
  await q('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(newPassword,12),req.user.id]);
  res.json({ok:true});
});

router.delete('/users/:id', roles('admin'), async (req,res)=>{
  if(req.params.id==='admin1') return res.status(400).json({error:'لا يمكن حذف الإدارة العامة'});
  const {rowCount}=await q('DELETE FROM users WHERE id=$1',[req.params.id]);
  if(!rowCount) return res.status(404).json({error:'المستخدم غير موجود'});
  res.json({ok:true});
});

router.get('/records', async (req,res)=>{
  let rows;
  if(req.user.role==='student') rows=(await q('SELECT * FROM records WHERE student_id=$1 ORDER BY date DESC',[req.user.id])).rows;
  else if(req.user.role==='moshref') rows=(await q('SELECT r.* FROM records r JOIN users u ON u.id=r.student_id WHERE u.path_id=$1 ORDER BY r.date DESC',[req.user.path_id])).rows;
  else rows=(await q('SELECT * FROM records ORDER BY date DESC')).rows;
  res.json({records:rows.map(recordOut)});
});

router.post('/records', roles('admin','moshref','student'), async (req,res)=>{
  const {id,studentId,date,type,surah,fromAya,toAya,wujuh}=req.body||{};
  if(!studentId || !type || !surah || !fromAya || !toAya || Number(wujuh)<0.5) return res.status(400).json({error:'أكمل بيانات الورد'});
  if(!canAccessStudent(req,studentId) && !(await canAccessByPath(req,studentId))) return res.status(403).json({error:'لا يمكنك تعديل هذا الطالب'});
  const rid=id || 'w'+Date.now();
  const {rows}=await q(`INSERT INTO records(id,student_id,date,type,surah,from_aya,to_aya,wujuh) VALUES($1,$2,COALESCE($3,NOW()),$4,$5,$6,$7,$8) RETURNING *`,[rid,studentId,date,type,surah,Number(fromAya),Number(toAya),Math.round(Number(wujuh)*2)/2]);
  res.status(201).json({record:recordOut(rows[0])});
});

router.patch('/records/:id', async (req,res)=>{
  const old=(await q('SELECT * FROM records WHERE id=$1',[req.params.id])).rows[0];
  if(!old) return res.status(404).json({error:'السجل غير موجود'});
  if(!canAccessStudent(req,old.student_id) && !(await canAccessByPath(req,old.student_id))) return res.status(403).json({error:'لا يمكنك تعديل هذا السجل'});
  const {type,surah,fromAya,toAya,wujuh}=req.body||{};
  const {rows}=await q(`UPDATE records SET type=COALESCE($1,type),surah=COALESCE($2,surah),from_aya=COALESCE($3,from_aya),to_aya=COALESCE($4,to_aya),wujuh=COALESCE($5,wujuh) WHERE id=$6 RETURNING *`,[type,surah,fromAya&&Number(fromAya),toAya&&Number(toAya),wujuh==null?null:Math.max(.5,Math.round(Number(wujuh)*2)/2),req.params.id]);
  res.json({record:recordOut(rows[0])});
});

router.delete('/records/:id', async (req,res)=>{
  const old=(await q('SELECT student_id FROM records WHERE id=$1',[req.params.id])).rows[0];
  if(!old) return res.status(404).json({error:'السجل غير موجود'});
  if(!canAccessStudent(req,old.student_id) && !(await canAccessByPath(req,old.student_id))) return res.status(403).json({error:'لا يمكنك حذف هذا السجل'});
  await q('DELETE FROM records WHERE id=$1',[req.params.id]); res.json({ok:true});
});

router.get('/exams', async (req,res)=>{
  let rows;
  if(req.user.role==='student') rows=(await q('SELECT * FROM exams WHERE student_id=$1 ORDER BY date DESC',[req.user.id])).rows;
  else if(req.user.role==='moshref') rows=(await q('SELECT e.* FROM exams e JOIN users u ON u.id=e.student_id WHERE u.path_id=$1 ORDER BY e.date DESC',[req.user.path_id])).rows;
  else rows=(await q('SELECT * FROM exams ORDER BY date DESC')).rows;
  res.json({exams:rows.map(examOut)});
});

router.post('/exams', roles('admin','moshref'), async (req,res)=>{
  const {studentId,surah,grade='ممتاز',notes='',moshrefName='',date}=req.body||{};
  if(!studentId || !surah) return res.status(400).json({error:'اختر الطالب والسورة'});
  if(!(await canAccessByPath(req,studentId))) return res.status(403).json({error:'لا يمكنك تسجيل امتحان لهذا الطالب'});
  const {rows}=await q(`INSERT INTO exams(id,student_id,date,surah,grade,notes,moshref_name) VALUES($1,$2,COALESCE($3,NOW()),$4,$5,$6,$7) RETURNING *`,['e'+Date.now(),studentId,date,surah,grade,notes,moshrefName]);
  res.status(201).json({exam:examOut(rows[0])});
});

router.delete('/exams/:id', roles('admin','moshref'), async (req,res)=>{
  const old=(await q('SELECT student_id FROM exams WHERE id=$1',[req.params.id])).rows[0];
  if(!old) return res.status(404).json({error:'الامتحان غير موجود'});
  if(!(await canAccessByPath(req,old.student_id))) return res.status(403).json({error:'لا يمكنك حذف هذا الامتحان'});
  await q('DELETE FROM exams WHERE id=$1',[req.params.id]); res.json({ok:true});
});

router.get('/reports/weekly', roles('admin','moshref'), async (req,res)=>{
  const path=req.user.role==='admin' ? '' : 'AND u.path_id=$1';
  const params=req.user.role==='admin' ? [] : [req.user.path_id];
  const {rows}=await q(`SELECT u.id,u.full_name,COALESCE(SUM(r.wujuh),0) AS wujuh FROM users u LEFT JOIN records r ON r.student_id=u.id AND r.date>=NOW()-INTERVAL '7 days' WHERE u.role='student' ${path} GROUP BY u.id,u.full_name ORDER BY u.full_name`,params);
  res.json({report:rows.map(x=>({studentId:x.id,fullName:x.full_name,wujuh:Number(x.wujuh)}))});
});

router.get('/reports/monthly', roles('admin','moshref'), async (req,res)=>{
  const path=req.user.role==='admin' ? '' : 'AND u.path_id=$1';
  const params=req.user.role==='admin' ? [] : [req.user.path_id];
  const {rows}=await q(`SELECT u.id,u.full_name,COALESCE(SUM(CASE WHEN r.date>=NOW()-INTERVAL '30 days' THEN r.wujuh ELSE 0 END),0) monthly,COALESCE(SUM(r.wujuh),0) total FROM users u LEFT JOIN records r ON r.student_id=u.id WHERE u.role='student' ${path} GROUP BY u.id,u.full_name ORDER BY u.full_name`,params);
  res.json({report:rows.map(x=>({studentId:x.id,fullName:x.full_name,monthly:Number(x.monthly),total:Number(x.total)}))});
});

router.get('/reports/student/:id', async (req,res)=>{
  const id=req.params.id;
  if(req.user.role==='student' && req.user.id!==id) return res.status(403).json({error:'لا يمكنك رؤية تقرير طالب آخر'});
  if(req.user.role==='moshref' && !(await canAccessByPath(req,id))) return res.status(403).json({error:'لا يمكنك رؤية هذا الطالب'});
  const student=(await q('SELECT * FROM users WHERE id=$1 AND role=\'student\'',[id])).rows[0];
  if(!student) return res.status(404).json({error:'الطالب غير موجود'});
  const records=(await q('SELECT * FROM records WHERE student_id=$1 ORDER BY date DESC',[id])).rows.map(recordOut);
  const exams=(await q('SELECT * FROM exams WHERE student_id=$1 ORDER BY date DESC',[id])).rows.map(examOut);
  const total=records.reduce((a,x)=>a+x.wujuh,0);
  const week=records.filter(x=>new Date(x.date)>=new Date(Date.now()-604800000)).reduce((a,x)=>a+x.wujuh,0);
  const month=records.filter(x=>new Date(x.date)>=new Date(Date.now()-2592000000)).reduce((a,x)=>a+x.wujuh,0);
  res.json({student:publicUser(student),total,week,month,records,exams});
});


router.post('/state/sync', async (req,res)=>{
  const { users, records, exams, header } = req.body || {};
  const role=req.user.role;
  const visibleStudentsQuery = role==='admin'
    ? {sql:`SELECT id FROM users WHERE role='student'`,params:[]}
    : role==='moshref'
      ? {sql:`SELECT id FROM users WHERE role='student' AND path_id=$1`,params:[req.user.path_id]}
      : {sql:`SELECT id FROM users WHERE id=$1 AND role='student'`,params:[req.user.id]};

  if (Array.isArray(users)) {
    for (const u of users) {
      if (!u?.id || u.id==='admin1') continue;
      let allowed=role==='admin';
      if(role==='moshref') allowed=(u.role==='student' && u.pathId===req.user.path_id);
      if(role==='student') allowed=(u.id===req.user.id);
      if(!allowed) continue;
      await q(`UPDATE users SET full_name=COALESCE($1,full_name),phone=COALESCE($2,phone),whatsapp=COALESCE($3,whatsapp),path_id=COALESCE($4,path_id),avatar=COALESCE($5,avatar) WHERE id=$6`,[u.fullName,u.phone,u.whatsapp,u.pathId,u.avatar,u.id]);
    }
    if(role==='admin'){
      const keep=users.map(u=>u?.id).filter(Boolean);
      await q(`DELETE FROM users WHERE id<>'admin1' AND id <> ALL($1::text[])`,[keep.length?keep:['__none__']]);
    } else if(role==='moshref'){
      const keep=users.filter(u=>u?.role==='student'&&u.pathId===req.user.path_id).map(u=>u.id);
      await q(`DELETE FROM users WHERE role='student' AND path_id=$1 AND id <> ALL($2::text[])`,[req.user.path_id,keep.length?keep:['__none__']]);
    }
  }

  if (Array.isArray(records)) {
    for (const r of records) {
      if(!r?.id || !r.studentId) continue;
      if(!canAccessStudent(req,r.studentId) && !(await canAccessByPath(req,r.studentId))) continue;
      await q(`INSERT INTO records(id,student_id,date,type,surah,from_aya,to_aya,wujuh) VALUES($1,$2,COALESCE($3,NOW()),$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET student_id=EXCLUDED.student_id,date=EXCLUDED.date,type=EXCLUDED.type,surah=EXCLUDED.surah,from_aya=EXCLUDED.from_aya,to_aya=EXCLUDED.to_aya,wujuh=EXCLUDED.wujuh`,[r.id,r.studentId,r.date,r.type,r.surah,Number(r.fromAya),Number(r.toAya),Math.max(.5,Math.round(Number(r.wujuh)*2)/2)]);
    }
    const ids=records.map(r=>r?.id).filter(Boolean);
    if(role==='admin') await q(`DELETE FROM records WHERE id <> ALL($1::text[])`,[ids.length?ids:['__none__']]);
    else if(role==='moshref') await q(`DELETE FROM records WHERE id NOT IN (SELECT x FROM unnest($1::text[]) x) AND student_id IN (SELECT id FROM users WHERE role='student' AND path_id=$2)`,[ids,req.user.path_id]);
    else await q(`DELETE FROM records WHERE student_id=$1 AND id <> ALL($2::text[])`,[req.user.id,ids.length?ids:['__none__']]);
  }

  if (Array.isArray(exams)) {
    for (const x of exams) {
      if(!x?.id || !x.studentId) continue;
      if(role==='student' || !(await canAccessByPath(req,x.studentId))) continue;
      await q(`INSERT INTO exams(id,student_id,date,surah,grade,notes,moshref_name) VALUES($1,$2,COALESCE($3,NOW()),$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET student_id=EXCLUDED.student_id,date=EXCLUDED.date,surah=EXCLUDED.surah,grade=EXCLUDED.grade,notes=EXCLUDED.notes,moshref_name=EXCLUDED.moshref_name`,[x.id,x.studentId,x.date,x.surah,x.grade,x.notes||'',x.moshrefName||'']);
    }
    const ids=exams.map(x=>x?.id).filter(Boolean);
    if(role==='admin') await q(`DELETE FROM exams WHERE id <> ALL($1::text[])`,[ids.length?ids:['__none__']]);
    else if(role==='moshref') await q(`DELETE FROM exams WHERE id NOT IN (SELECT x FROM unnest($1::text[]) x) AND student_id IN (SELECT id FROM users WHERE role='student' AND path_id=$2)`,[ids,req.user.path_id]);
    else await q(`DELETE FROM exams WHERE student_id=$1 AND id <> ALL($2::text[])`,[req.user.id,ids.length?ids:['__none__']]);
  }

  if(header!==undefined && role==='admin'){
    await q(`INSERT INTO settings(key,value) VALUES('header',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,[String(header||'')]);
  }
  res.json({ok:true});
});

router.get('/settings/header', async (_,res)=>res.json({header:(await q("SELECT value FROM settings WHERE key='header'")).rows[0]?.value||null}));
router.put('/settings/header', roles('admin'), async (req,res)=>{ await q(`INSERT INTO settings(key,value) VALUES('header',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,[String(req.body?.header||'')]); res.json({ok:true,header:req.body?.header||''}); });

export default router;
