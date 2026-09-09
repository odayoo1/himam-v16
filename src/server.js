import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import { auth } from './middleware/auth.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',').map(x=>x.trim()), credentials:false } : { credentials:false }));
app.use(express.json({ limit:'5mb' }));
app.use(rateLimit({ windowMs:15*60*1000, max:300, standardHeaders:true, legacyHeaders:false }));

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const frontendDir=path.join(__dirname,'..','frontend');
app.use(express.static(frontendDir));

app.get('/api/health', (_,res)=>res.json({ok:true,name:'Himam V16 API',version:'1.0.0'}));
app.use('/api/auth', authRoutes);
app.use('/api', dataRoutes);
app.get('/{*splat}', (req,res,next)=>{ if(req.path.startsWith('/api/')) return next(); res.sendFile(path.join(frontendDir,'index.html')); });
app.use((err,_req,res,_next)=>{ console.error(err); res.status(500).json({error:'خطأ داخلي في الخادم'}); });

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`Himam API listening on :${port}`));
