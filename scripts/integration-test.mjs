import assert from 'node:assert/strict';
const base='http://127.0.0.1:3001';
const prefix='__test_'+Date.now();const ids=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function call(route,options={}){const r=await fetch(base+'/api'+route,options);const body=await r.json();return {status:r.status,body};}
const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function form(language,term,meaning){const f=new FormData();f.set('language',language);f.set('term',term);f.set('meaning',meaning);return f;}
try{
 let f=form('en',prefix,'nghĩa tiếng Việt');f.set('image',new Blob([png],{type:'image/png'}),'test.png');let r=await call('/words',{method:'POST',body:f});assert.equal(r.status,200);ids.push(r.body.id);
 let list=(await call('/words?language=en')).body;let w=list.find(w=>w.id===ids[0]);assert.equal(w.meaning,'nghĩa tiếng Việt');assert.equal(w.is_due,1,'New card must be due immediately');assert.ok(w.image);assert.equal((await fetch(base+'/images/'+w.image)).status,200);console.log('PASS: create word, UTF-8, due status, copied image');
 r=await call('/words',{method:'POST',body:form('en',prefix,'duplicate')});assert.equal(r.status,400);
 r=await call('/words',{method:'POST',body:form('zh',prefix,'ngôn ngữ độc lập')});assert.equal(r.status,200);ids.push(r.body.id);console.log('PASS: duplicates isolated by language');
 const text=`${prefix}\t\tnghĩa cập nhật\tví dụ\tbản dịch\tphoto.png\n${prefix}_2\tIPA\ttừ thứ hai\t\t\tmissing.png\n${prefix}_2\t\ttrùng trong file\ninvalid\t\t`;
 r=await call('/import/preview',json({language:'en',text}));assert.equal(r.body[0].duplicate,true);assert.equal(r.body[2].duplicate,true);assert.ok(r.body[3].error);
 f=new FormData();f.set('language','en');f.set('text',text);f.set('duplicate','skip');f.set('images',new Blob([png],{type:'image/png'}),'photo.png');r=await call('/import',{method:'POST',body:f});assert.deepEqual([r.body.added,r.body.skipped,r.body.errors],[1,2,1]);assert.equal(r.body.warnings.length,1);console.log('PASS: preview, invalid line, duplicate skip, missing image warning');
 list=(await call('/words?language=en')).body;ids.push(list.find(w=>w.term===prefix+'_2').id);
 f=new FormData();f.set('language','en');f.set('text',`${prefix}\t\tnghĩa cập nhật\tví dụ\tbản dịch\tphoto.png`);f.set('duplicate','update');f.set('images',new Blob([png],{type:'image/png'}),'photo.png');r=await call('/import',{method:'POST',body:f});assert.equal(r.body.updated,1);w=(await call('/words?language=en')).body.find(w=>w.id===ids[0]);assert.equal(w.meaning,'nghĩa cập nhật');assert.ok(w.image);console.log('PASS: import update and matching image');
 const oldImage=w.image;
 f=form('en',prefix,'sửa thủ công');f.set('removeImage','true');r=await call('/words/'+ids[0],{method:'PUT',body:f});assert.equal(r.status,200);w=(await call('/words?language=en')).body.find(w=>w.id===ids[0]);assert.equal(w.image,null);
 for(const rating of ['again','hard','good','easy']){r=await call('/words/'+ids[0]+'/review',json({rating}));assert.equal(r.status,200);assert.ok(new Date(r.body.due)>new Date());}
 w=(await call('/words?language=en')).body.find(w=>w.id===ids[0]);assert.equal(w.reviews,4);assert.equal(w.is_due,0);console.log('PASS: edit, remove image, all 4 review ratings saved');
 f=form('en',prefix+'_bad','invalid image');f.set('image',new Blob(['not an image'],{type:'image/png'}),'bad.png');r=await call('/words',{method:'POST',body:f});assert.equal(r.status,400);
 f=form('en',prefix+'_big','oversize image');f.set('image',new Blob([Buffer.alloc(5*1024*1024+1)],{type:'image/png'}),'large.png');r=await call('/words',{method:'POST',body:f});assert.equal(r.status,400);
 console.log('PASS: reject invalid image and images larger than 5 MB');
 const foreign=await call('/words',{...json({}),headers:{'Content-Type':'application/json','Origin':'https://example.com'}});assert.equal(foreign.status,403);console.log('PASS: foreign origin mutation blocked');
 const fs=await import('node:fs');fs.writeFileSync('.persistence-test.json',JSON.stringify({id:ids[0],meaning:w.meaning,reviews:w.reviews,due_at:w.due_at,ids,images:[oldImage]}));
 console.log('Persistence fixture saved for process restart.');
}catch(e){console.error(e);for(const id of ids)await call('/words/'+id,{method:'DELETE'});process.exitCode=1;}
