import 'dotenv/config';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import mysql from 'mysql2/promise';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {parseText,schedule} from './core.js';
import {migrate} from './migrate.js';
import {migrateLexiFlow,installLexiFlow} from './lexiflow.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
dotenv.config({path:path.join(root,'.env')});
const images=path.join(root,'data/images'); await mkdir(images,{recursive:true});
const db=mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,charset:'utf8mb4',timezone:'Z',connectionLimit:5});
db.on('connection',connection=>connection.query("SET time_zone = '+00:00'"));
await migrate(db);
await migrateLexiFlow(db);
const app=express(); app.use(express.json({limit:'5mb'}));
app.use((req,res,next)=>{const raw=req.headers.cookie||'';req.cookies=Object.fromEntries(raw.split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('=');return i<0?[v,'']: [decodeURIComponent(v.slice(0,i)),decodeURIComponent(v.slice(i+1))];}));next();});
app.use('/api',(req,res,next)=>{const origin=req.get('origin');if(origin&&!['GET','HEAD'].includes(req.method)&&origin!==`http://127.0.0.1:${process.env.PORT||3001}`&&origin!=='http://127.0.0.1:5173')return res.status(403).json({error:'Nguồn yêu cầu không được phép.'});next();});
app.use('/images',express.static(images));
installLexiFlow(app,db,{cookieSecure:process.env.COOKIE_SECURE==='true'});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:100,fieldSize:5*1024*1024}});
function language(value){if(!['en','zh'].includes(value)) throw Error('Ngôn ngữ không hợp lệ.');return value;}
function valid(b){language(b.language); if(!b.term?.trim()||!b.meaning?.trim())throw Error('Vui lòng nhập từ và nghĩa.');if(b.term.length>255||(b.pronunciation||'').length>255)throw Error('Từ hoặc phiên âm tối đa 255 ký tự.');}
async function validTopic(topicId,lang){const id=Number(topicId);if(!Number.isSafeInteger(id)||id<1)throw Error('Hãy chọn một chủ đề.');const [rows]=await db.execute('SELECT id FROM topics WHERE id=? AND language=?',[id,lang]);if(!rows.length)throw Error('Chủ đề không tồn tại hoặc không thuộc ngôn ngữ đã chọn.');return id;}
async function saveImage(f){
 if(!f)return null;
 const b=f.buffer;
 const ext=b[0]===137&&b.subarray(1,4).toString()==='PNG'?'.png':b[0]===255&&b[1]===216&&b[2]===255?'.jpg':b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'?'.webp':null;
 if(!ext)throw Error(`Ảnh ${f.originalname}: chỉ hỗ trợ PNG, JPEG, WebP (tối đa 5 MB).`);
 const name=randomUUID()+ext; await writeFile(path.join(images,name),b);return name;
}
app.get('/api/health',async(req,res)=>{await db.query('SELECT 1');res.json({ok:true});});
app.get('/api/topics',async(req,res)=>{
 const lang=language(req.query.language);const [rows]=await db.execute(`SELECT t.id,t.name,t.language,t.created_at,COUNT(w.id) AS word_count,COALESCE(SUM(w.due_at<=UTC_TIMESTAMP(3)),0) AS due_count FROM topics t LEFT JOIN words w ON w.topic_id=t.id AND w.language=t.language WHERE t.language=? GROUP BY t.id ORDER BY t.name COLLATE utf8mb4_unicode_ci,t.id`,[lang]);res.json(rows);
});
app.post('/api/topics',async(req,res)=>{
 const lang=language(req.body.language);const name=String(req.body.name||'').trim();if(!name)throw Error('Nhập tên chủ đề.');if(name.length>120)throw Error('Tên chủ đề tối đa 120 ký tự.');
 const [r]=await db.execute('INSERT INTO topics(language,name) VALUES(?,?)',[lang,name]);res.json({id:r.insertId,name,language:lang,word_count:0,due_count:0});
});
app.get('/api/words',async(req,res)=>{
 const lang=language(req.query.language);const topicId=await validTopic(req.query.topic_id,lang);const [rows]=await db.execute('SELECT *, due_at <= UTC_TIMESTAMP(3) AS is_due FROM words WHERE language=? AND topic_id=? ORDER BY created_at DESC,id DESC',[lang,topicId]);res.json(rows);
});
app.post('/api/words',upload.single('image'),async(req,res)=>{
 valid(req.body);const topicId=await validTopic(req.body.topic_id,req.body.language);const image=await saveImage(req.file);const b=req.body;
 try{const [r]=await db.execute('INSERT INTO words(language,topic_id,term,part_of_speech,pronunciation,meaning,example,translation,image) VALUES(?,?,?,?,?,?,?,?,?)',[b.language,topicId,b.term.trim(),b.part_of_speech||'',b.pronunciation||'',b.meaning.trim(),b.example||'',b.translation||'',image]);res.json({id:r.insertId});}catch(e){if(image)await unlink(path.join(images,image));throw e;}
});
app.put('/api/words/:id',upload.single('image'),async(req,res)=>{
 valid(req.body);const topicId=await validTopic(req.body.topic_id,req.body.language); const [old]=await db.execute('SELECT * FROM words WHERE id=? AND topic_id=? AND language=?',[req.params.id,topicId,req.body.language]);if(!old.length)return res.status(404).json({error:'Không tìm thấy từ trong chủ đề này.'});
 const image=await saveImage(req.file);const b=req.body;
 try{await db.execute('UPDATE words SET term=?,part_of_speech=?,pronunciation=?,meaning=?,example=?,translation=?,image=? WHERE id=?',[b.term.trim(),b.part_of_speech||'',b.pronunciation||'',b.meaning.trim(),b.example||'',b.translation||'',image||(b.removeImage==='true'?null:old[0].image),req.params.id]);res.json({ok:true});}catch(e){if(image)await unlink(path.join(images,image));throw e;}
});
app.delete('/api/words/:id',async(req,res)=>{await db.execute('DELETE FROM words WHERE id=?',[req.params.id]);res.json({ok:true});});
app.post('/api/import/preview',async(req,res)=>{
 const lang=language(req.body.language);const topicId=await validTopic(req.body.topic_id,lang);const rows=parseText(req.body.text||'');const [existing]=await db.execute('SELECT term FROM words WHERE language=? AND topic_id=?',[lang,topicId]);const seen=existing.map(w=>w.term);const compare=new Intl.Collator('en',{sensitivity:'base'});
 res.json(rows.map(r=>{const duplicate=seen.some(term=>compare.compare(term,r.term)===0);if(!r.error)seen.push(r.term);return {...r,duplicate};}));
});
app.post('/api/import',upload.array('images',100),async(req,res)=>{
 const lang=language(req.body.language);const topicId=await validTopic(req.body.topic_id,lang);if(!['skip','update'].includes(req.body.duplicate))throw Error('Chọn cách xử lý từ trùng.');
 const rows=parseText(req.body.text||'');const files=new Map((req.files||[]).map(f=>[f.originalname,f]));
 // Validate all selected images before changing the database.
 for(const f of files.values()){const name=await saveImage(f);await unlink(path.join(images,name));}
 const result={added:0,updated:0,skipped:0,errors:0,warnings:[]};
 const conn=await db.getConnection();const created=[];
 try{await conn.beginTransaction();for(const r of rows){if(r.error){result.errors++;continue;}
 const [old]=await conn.execute('SELECT id,image FROM words WHERE language=? AND topic_id=? AND term=?',[lang,topicId,r.term]);
 if(old.length&&req.body.duplicate==='skip'){result.skipped++;continue;}
 const f=files.get(r.filename);if(r.filename&&!f)result.warnings.push(`Dòng ${r.line}: không tìm thấy ảnh ${r.filename}.`);
 const image=await saveImage(f);if(image)created.push(image);
 if(old.length){await conn.execute('UPDATE words SET part_of_speech=?,pronunciation=?,meaning=?,example=?,translation=?,image=? WHERE id=?',[r.part_of_speech,r.pronunciation,r.meaning,r.example,r.translation,image||old[0].image,old[0].id]);result.updated++;}
 else{await conn.execute('INSERT INTO words(language,topic_id,term,part_of_speech,pronunciation,meaning,example,translation,image) VALUES(?,?,?,?,?,?,?,?,?)',[lang,topicId,r.term,r.part_of_speech,r.pronunciation,r.meaning,r.example,r.translation,image]);result.added++;}
 }await conn.commit();res.json(result);}catch(e){await conn.rollback();await Promise.all(created.map(n=>unlink(path.join(images,n)).catch(()=>{})));throw e;}finally{conn.release();}
});
app.post('/api/words/:id/review',async(req,res)=>{
 if(!['again','hard','good','easy'].includes(req.body.rating))throw Error('Đánh giá không hợp lệ.');const c=await db.getConnection();
 try{await c.beginTransaction();const [rows]=await c.execute('SELECT * FROM words WHERE id=? FOR UPDATE',[req.params.id]);if(!rows.length)throw Error('Không tìm thấy từ.');const next=schedule(rows[0].interval_days,req.body.rating);
 await c.execute('UPDATE words SET interval_days=?,due_at=?,reviews=reviews+1 WHERE id=?',[next.days,next.due,req.params.id]);await c.execute('INSERT INTO review_log(word_id,rating,due_at) VALUES(?,?,?)',[req.params.id,req.body.rating,next.due]);await c.commit();res.json(next);
 }catch(e){await c.rollback();throw e;}finally{c.release();}
});
app.use(express.static(path.join(root,'frontend/dist')));
app.use((req,res,next)=>{if(req.method==='GET'&&!req.path.startsWith('/api/')&&!path.extname(req.path))return res.sendFile(path.join(root,'frontend/dist/index.html'));next();});
app.use((err,req,res,next)=>{console.error(err.message);const duplicate=err.code==='ER_DUP_ENTRY';const message=duplicate&&req.path==='/topics'?'Tên chủ đề này đã tồn tại trong ngôn ngữ đã chọn.':duplicate?'Dữ liệu bị trùng.':err.code==='LIMIT_FILE_SIZE'?'Ảnh vượt quá 5 MB.':err.status?err.message:'Đã có lỗi máy chủ. Vui lòng thử lại.';const status=err.status||(req.path.startsWith('/api/v1')?500:400);res.status(status).json({error:message});});
app.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log('Flashcard API sẵn sàng.'));
