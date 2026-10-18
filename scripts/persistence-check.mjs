import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';
import mysql from '../backend/node_modules/mysql2/promise.js';
const root=process.cwd();const fixturePath=path.join(root,'.topic-test.json');const fixture=JSON.parse(fs.readFileSync(fixturePath));const env=dotenv.parse(fs.readFileSync('.env'));
for(const topicId of fixture.topics.slice(0,1)){
 const r=await fetch(`http://127.0.0.1:${env.PORT||3001}/api/words?language=en&topic_id=${topicId}`);assert.equal(r.status,200);const words=await r.json();
 const word=words.find(w=>w.id===fixture.wordIds[0]);assert.ok(word,'word must survive backend restart');assert.equal(word.reviews,4);assert.equal(word.meaning,'nghĩa có dấu');assert.ok(word.image);console.log('PASS: topic words, image and saved review progress survive restart');
}
const c=await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME});const ids=fixture.topics;
const [rows]=await c.execute('SELECT image FROM words WHERE topic_id IN ('+ids.map(()=>'?').join(',')+')',ids);
await c.execute('DELETE FROM words WHERE topic_id IN ('+ids.map(()=>'?').join(',')+')',ids);await c.execute('DELETE FROM topics WHERE id IN ('+ids.map(()=>'?').join(',')+')',ids);await c.end();
const images=new Set([...fixture.imageNames,...rows.map(x=>x.image).filter(Boolean)]);
for(const name of images){const target=path.resolve(root,'data/images',name);if(target.startsWith(path.resolve(root,'data/images')+path.sep)&&fs.existsSync(target))fs.unlinkSync(target);}
fs.unlinkSync(fixturePath);console.log('PASS: disposable topics and images removed after verification');
