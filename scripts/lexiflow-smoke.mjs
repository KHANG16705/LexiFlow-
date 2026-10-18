import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
require('dotenv').config({path:path.resolve(process.cwd(),'.env')});
const mysql=require('mysql2/promise');

const base=`http://127.0.0.1:${process.env.PORT||3001}/api/v1`;
const email=`lexiflow-check-${randomUUID()}@example.test`;
let cookie=''; let userId=null;
const checks=[];
async function request(path,{method='GET',body}={}){
  const response=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  const set=response.headers.get('set-cookie'); if(set)cookie=set.split(';')[0];
  return {response,data};
}
function assert(condition,message){if(!condition)throw new Error(message);checks.push(message);}

try{
  let r=await request('/decks');assert(r.response.ok&&r.data.items.length>0,'Library returns migrated public decks');
  r=await request('/decks?q=B1&level=B1');assert(r.response.ok&&r.data.items.every(d=>d.level==='B1'),'Search and CEFR filters are applied by the API');
  const deckId=r.data.items[0].id;
  r=await request('/decks/'+deckId+'/vocabularies');assert(r.response.ok&&r.data.length>0,'Deck detail returns real vocabulary');
  const wordId=r.data[0].id;
  r=await request('/my-decks');assert(r.response.status===401,'Private deck API requires authentication');
  r=await request('/auth/register',{method:'POST',body:{name:'LexiFlow Check',email,password:'A-secure-check-pass-42'}});assert(r.response.status===201,'Registration creates a user and session');userId=r.data.user.id;
  r=await request('/auth/me');assert(r.response.ok&&r.data.user?.email===email,'Session cookie authenticates the current user');
  r=await request('/my-decks',{method:'POST',body:{name:'My test deck',description:'Temporary integration check'}});assert(r.response.status===201,'User can create a private deck');const myDeckId=r.data.id;
  r=await request(`/my-decks/${myDeckId}`,{method:'PATCH',body:{name:'Updated test deck',description:'Updated temporary description'}});assert(r.response.ok,'User can edit the name and description of their deck');
  r=await request(`/my-decks/${myDeckId}/vocabularies`,{method:'POST',body:{vocabulary_id:wordId}});assert(r.response.status===201,'User can add a real vocabulary item to a private deck');
  r=await request('/study-sessions',{method:'POST',body:{deck_id:myDeckId,session_type:'free'}});assert(r.response.status===201&&r.data.cards.length===1,`Study session returns the private deck card (${r.response.status}: ${JSON.stringify(r.data)})`);const sessionId=r.data.id;
  r=await request(`/study-sessions/${sessionId}/reviews`,{method:'POST',body:{vocabulary_id:wordId,rating:'good'}});assert(r.response.status===409,'A rating cannot be saved before revealing the answer');
  r=await request(`/study-sessions/${sessionId}/reveal`,{method:'POST',body:{vocabulary_id:wordId}});assert(r.response.ok,'Backend records that the answer was revealed');
  r=await request(`/study-sessions/${sessionId}/reviews`,{method:'POST',body:{vocabulary_id:wordId,rating:'good'}});assert(r.response.status===409,'Free study cannot change the review schedule');
  r=await request(`/study-sessions/${sessionId}/complete`,{method:'POST'});assert(r.response.ok,'Free study can be completed without writing a review');
  r=await request('/study-sessions',{method:'POST',body:{deck_id:myDeckId,session_type:'learn'}});assert(r.response.status===201,'A scheduled learning session starts');const scheduledId=r.data.id;
  r=await request(`/study-sessions/${scheduledId}/reveal`,{method:'POST',body:{vocabulary_id:wordId}});assert(r.response.ok,'A learning answer can be revealed');
  r=await request(`/study-sessions/${scheduledId}/reviews`,{method:'POST',body:{vocabulary_id:wordId,rating:'good'}});assert(r.response.ok&&r.data.due_at,'Rating is saved and returns its next review time');
  r=await request(`/study-sessions/${scheduledId}/reviews`,{method:'POST',body:{vocabulary_id:wordId,rating:'good'}});assert(r.response.status===409,'Repeated card rating in one session is rejected');
  r=await request(`/study-sessions/${scheduledId}/complete`,{method:'POST'});assert(r.response.ok&&Number(r.data.cards_reviewed)===1,'Session completion returns saved totals');
  r=await request(`/decks/${myDeckId}/progress`);assert(r.response.ok&&Number(r.data.encountered)===1,'Private deck progress comes from the account review data');
  r=await request('/dashboard');assert(r.response.ok&&Number(r.data.stats.encountered)>=1&&r.data.ratings.length>0,'Dashboard and rating distribution use stored progress');
  r=await request('/my-decks');assert(r.response.ok&&r.data.some(d=>d.id===myDeckId),'Private decks are scoped to the signed in user');
  r=await request(`/my-decks/${myDeckId}/vocabularies/${wordId}`,{method:'DELETE'});assert(r.response.ok,'User can remove a card from their private deck');
  r=await request('/auth/logout',{method:'POST'});assert(r.response.ok,'Logout ends the session');
  r=await request('/auth/me');assert(r.response.ok&&!r.data.user,'Logout clears the session cookie');
  r=await request('/decks/'+myDeckId);assert(r.response.status===404,'Another visitor cannot read the private deck');
  console.log(`Passed ${checks.length} LexiFlow integration checks.`);
}finally{
  if(userId){const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,charset:'utf8mb4'});await db.execute('DELETE FROM users WHERE id=?',[userId]);await db.end();}
}
