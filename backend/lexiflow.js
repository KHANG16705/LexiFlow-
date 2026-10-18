import {createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {schedule} from './core.js';

const scrypt = promisify(scryptCallback);
const DAY = 86_400_000;
const cookieName = 'lexiflow_session';
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const cleanUser = user => ({id:user.id, name:user.name, email:user.email});

export async function migrateLexiFlow(db) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS auth_sessions (
      id CHAR(64) PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY session_expiry(expires_at),
      CONSTRAINT auth_session_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS decks (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      topic_id INT UNSIGNED NULL UNIQUE,
      owner_id INT UNSIGNED NULL,
      name VARCHAR(140) NOT NULL,
      slug VARCHAR(180) NOT NULL UNIQUE,
      description TEXT NOT NULL,
      level ENUM('A1','A2','B1','B2','C1','C2') NULL,
      goal VARCHAR(80) NOT NULL DEFAULT 'general',
      category VARCHAR(80) NOT NULL DEFAULT 'general',
      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY deck_filters(is_public,level,goal,category),
      KEY deck_owner(owner_id),
      CONSTRAINT deck_topic FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE SET NULL,
      CONSTRAINT deck_owner_user FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS deck_vocabularies (
      deck_id INT UNSIGNED NOT NULL,
      vocabulary_id INT UNSIGNED NOT NULL,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      added_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY(deck_id,vocabulary_id),
      KEY deck_word_order(deck_id,position),
      CONSTRAINT deck_vocab_deck FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE CASCADE,
      CONSTRAINT deck_vocab_word FOREIGN KEY(vocabulary_id) REFERENCES words(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS user_vocabulary_progress (
      user_id INT UNSIGNED NOT NULL,
      vocabulary_id INT UNSIGNED NOT NULL,
      status ENUM('new','learning','review','mastered') NOT NULL DEFAULT 'new',
      repetitions INT UNSIGNED NOT NULL DEFAULT 0,
      interval_days DOUBLE NOT NULL DEFAULT 0,
      due_at DATETIME(3) NULL,
      last_reviewed_at DATETIME(3) NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY(user_id,vocabulary_id),
      KEY progress_due(user_id,due_at),
      CONSTRAINT progress_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT progress_word FOREIGN KEY(vocabulary_id) REFERENCES words(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS study_sessions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      deck_id INT UNSIGNED NULL,
      started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      ended_at DATETIME(3) NULL,
      cards_reviewed INT UNSIGNED NOT NULL DEFAULT 0,
      correct_count INT UNSIGNED NOT NULL DEFAULT 0,
      session_type ENUM('learn','review','free') NOT NULL,
      KEY user_session_date(user_id,started_at),
      CONSTRAINT study_session_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT study_session_deck FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE SET NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS study_session_cards (
      session_id BIGINT UNSIGNED NOT NULL,
      vocabulary_id INT UNSIGNED NOT NULL,
      revealed_at DATETIME(3) NULL,
      reviewed_at DATETIME(3) NULL,
      PRIMARY KEY(session_id,vocabulary_id),
      CONSTRAINT session_card_session FOREIGN KEY(session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
      CONSTRAINT session_card_word FOREIGN KEY(vocabulary_id) REFERENCES words(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS review_history (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      vocabulary_id INT UNSIGNED NOT NULL,
      deck_id INT UNSIGNED NULL,
      session_id BIGINT UNSIGNED NOT NULL,
      rating ENUM('again','hard','good','easy') NOT NULL,
      reviewed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      due_at DATETIME(3) NOT NULL,
      UNIQUE KEY one_review_per_card_session(session_id,vocabulary_id),
      KEY user_review_date(user_id,reviewed_at),
      KEY user_review_due(user_id,due_at),
      CONSTRAINT review_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT review_word FOREIGN KEY(vocabulary_id) REFERENCES words(id) ON DELETE CASCADE,
      CONSTRAINT review_deck FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE SET NULL,
      CONSTRAINT review_session FOREIGN KEY(session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  ];
  for (const sql of statements) await db.query(sql);
  const [topics] = await db.query('SELECT id,language,name FROM topics ORDER BY id');
  for (const topic of topics) {
    const level = /\bA1\b/i.test(topic.name)?'A1':/\bA2\b/i.test(topic.name)?'A2':/\bB1\b/i.test(topic.name)?'B1':/\bB2\b/i.test(topic.name)?'B2':/\bC1\b/i.test(topic.name)?'C1':/\bC2\b/i.test(topic.name)?'C2':null;
    const slug = `${topic.language}-${topic.id}-${topic.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120)}`;
    await db.execute(`INSERT IGNORE INTO decks(topic_id,name,slug,description,level,goal,category,is_public)
      VALUES(?,?,?, ?,?,'general',?,TRUE)`,[topic.id,topic.name,slug,`Bộ từ ${topic.language==='en'?'tiếng Anh':'tiếng Trung'} được chuyển từ dữ liệu hiện có.`,level,topic.name]);
    const [[deck]]=await db.execute('SELECT id FROM decks WHERE topic_id=?',[topic.id]);
    await db.execute(`INSERT IGNORE INTO deck_vocabularies(deck_id,vocabulary_id,position)
      SELECT ?,w.id,w.id FROM words w WHERE w.topic_id=?`,[deck.id,topic.id]);
  }
  await db.query("INSERT IGNORE INTO schema_migrations(version) VALUES('0002_lexiflow')");
}

export function installLexiFlow(app, db, {cookieSecure = false} = {}) {
  const attempts = new Map();
  const api = fn => async (req,res,next) => { try { await fn(req,res,next); } catch (error) { next(error); } };
  const fail = (message,status=400) => Object.assign(new Error(message),{status});
  const limited = req => {
    const key = req.ip || req.socket.remoteAddress || 'local';
    const now = Date.now(); const record = attempts.get(key);
    if (!record || now-record.start > 60_000) attempts.set(key,{start:now,count:1});
    else { record.count++; if (record.count>12) throw fail('Bạn thử quá nhiều lần. Vui lòng chờ một phút.',429); }
    if (attempts.size>2000) for (const [k,v] of attempts) if (now-v.start>60_000) attempts.delete(k);
  };
  const setCookie = (res,token,maxAge) => res.cookie(cookieName,token,{httpOnly:true,sameSite:'lax',secure:cookieSecure,path:'/api/v1',maxAge});
  const clearCookie = res => res.clearCookie(cookieName,{httpOnly:true,sameSite:'lax',secure:cookieSecure,path:'/api/v1'});
  const auth = api(async(req,res,next)=>{
    const token=req.cookies?.[cookieName]; if (!token) { req.user=null; return next(); }
    const [rows]=await db.execute(`SELECT u.id,u.name,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>UTC_TIMESTAMP(3)`,[tokenHash(token)]);
    req.user=rows[0]||null; next();
  });
  const requireUser=(req,res,next)=>req.user?next():next(fail('Vui lòng đăng nhập để tiếp tục.',401));
  app.use('/api/v1',auth);
  app.get('/api/v1/auth/me', (req,res)=>res.json({user:req.user?cleanUser(req.user):null}));
  app.post('/api/v1/auth/register',api(async(req,res)=>{
    limited(req);
    const name=String(req.body.name||'').trim(); const email=String(req.body.email||'').trim().toLowerCase(); const password=String(req.body.password||'');
    if(name.length<2||name.length>80)throw fail('Tên cần có từ 2 đến 80 ký tự.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>190)throw fail('Địa chỉ email chưa hợp lệ.');
    if(password.length<10||password.length>128)throw fail('Mật khẩu cần có từ 10 đến 128 ký tự.');
    const salt=randomBytes(16); const derived=await scrypt(password,salt,64);
    const encoded=`scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
    let result; try { [result]=await db.execute('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)',[name,email,encoded]); }
    catch(e){if(e.code==='ER_DUP_ENTRY')throw fail('Email này đã được đăng ký.',409);throw e;}
    const token=randomBytes(32).toString('base64url'); await db.execute('INSERT INTO auth_sessions(id,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 DAY))',[tokenHash(token),result.insertId]);
    setCookie(res,token,30*DAY); res.status(201).json({user:{id:result.insertId,name,email}});
  }));
  app.post('/api/v1/auth/login',api(async(req,res)=>{
    limited(req); const email=String(req.body.email||'').trim().toLowerCase(); const password=String(req.body.password||'');
    const [rows]=await db.execute('SELECT id,name,email,password_hash FROM users WHERE email=?',[email]);
    if(!rows.length)throw fail('Email hoặc mật khẩu không đúng.',401);
    const [algorithm,saltHex,hashHex]=rows[0].password_hash.split('$');
    const candidate=Buffer.from(await scrypt(password,Buffer.from(saltHex,'hex'),64)); const expected=Buffer.from(hashHex,'hex');
    if(algorithm!=='scrypt'||candidate.length!==expected.length||!timingSafeEqual(candidate,expected))throw fail('Email hoặc mật khẩu không đúng.',401);
    const token=randomBytes(32).toString('base64url'); await db.execute('INSERT INTO auth_sessions(id,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 DAY))',[tokenHash(token),rows[0].id]);
    setCookie(res,token,30*DAY); res.json({user:cleanUser(rows[0])});
  }));
  app.post('/api/v1/auth/logout',api(async(req,res)=>{const token=req.cookies?.[cookieName];if(token)await db.execute('DELETE FROM auth_sessions WHERE id=?',[tokenHash(token)]);clearCookie(res);res.json({ok:true});}));

  app.get('/api/v1/topics',api(async(req,res)=>{const [rows]=await db.execute(`SELECT category AS id,category AS name,COUNT(*) AS deck_count FROM decks WHERE is_public=TRUE GROUP BY category ORDER BY category`);res.json(rows);}));
  app.get('/api/v1/decks',api(async(req,res)=>{
    const q=String(req.query.q||'').trim().slice(0,120);const level=String(req.query.level||'');const goal=String(req.query.goal||'');const category=String(req.query.topic||'');
    const page=Math.max(1,Math.min(10000,Number(req.query.page)||1));const limit=Math.max(1,Math.min(24,Number(req.query.limit)||12));
    const where=[`(d.is_public=TRUE OR d.owner_id=?)`];const values=[req.user?.id||0];
    if(q){where.push('(d.name LIKE ? OR d.description LIKE ?)');values.push(`%${q}%`,`%${q}%`);}
    if(level){where.push('d.level=?');values.push(level);}
    if(goal){where.push('d.goal=?');values.push(goal);}
    if(category){where.push('d.category=?');values.push(category);}
    const order=['name','words','level'].includes(req.query.sort)?req.query.sort:'name';
    const orderSql=order==='words'?'word_count DESC,d.name':order==='level'?"FIELD(d.level,'A1','A2','B1','B2','C1','C2'),d.name":'d.name';
    const [rows]=await db.execute(`SELECT d.id,d.name,d.slug,d.description,d.level,d.goal,d.category,d.is_public,COUNT(DISTINCT dv.vocabulary_id) AS word_count,
      SUM(CASE WHEN p.due_at<=UTC_TIMESTAMP(3) THEN 1 ELSE 0 END) AS due_count
      FROM decks d LEFT JOIN deck_vocabularies dv ON dv.deck_id=d.id LEFT JOIN user_vocabulary_progress p ON p.vocabulary_id=dv.vocabulary_id AND p.user_id=?
      WHERE ${where.join(' AND ')} GROUP BY d.id ORDER BY ${orderSql} LIMIT ? OFFSET ?`,[req.user?.id||0,...values,limit,(page-1)*limit]);
    const [[count]]=await db.execute(`SELECT COUNT(*) AS total FROM decks d WHERE ${where.join(' AND ')}`,values);
    res.json({items:rows,total:Number(count.total),page,limit});
  }));
  app.get('/api/v1/decks/:id',api(async(req,res)=>{
    const [rows]=await db.execute(`SELECT d.id,d.name,d.slug,d.description,d.level,d.goal,d.category,d.is_public,d.owner_id,COUNT(DISTINCT dv.vocabulary_id) AS word_count,
      SUM(CASE WHEN p.due_at<=UTC_TIMESTAMP(3) THEN 1 ELSE 0 END) AS due_count
      FROM decks d LEFT JOIN deck_vocabularies dv ON dv.deck_id=d.id LEFT JOIN user_vocabulary_progress p ON p.vocabulary_id=dv.vocabulary_id AND p.user_id=?
      WHERE d.id=? AND (d.is_public=TRUE OR d.owner_id=?) GROUP BY d.id`,[req.user?.id||0,req.params.id,req.user?.id||0]);
    if(!rows.length)throw fail('Không tìm thấy bộ từ.',404);res.json(rows[0]);
  }));
  app.get('/api/v1/decks/:id/vocabularies',api(async(req,res)=>{
    const [rows]=await db.execute(`SELECT w.id,w.term,w.part_of_speech,w.pronunciation,w.meaning,w.example,w.translation,w.image,p.status,p.due_at,p.repetitions
      FROM decks d JOIN deck_vocabularies dv ON dv.deck_id=d.id JOIN words w ON w.id=dv.vocabulary_id
      LEFT JOIN user_vocabulary_progress p ON p.vocabulary_id=w.id AND p.user_id=? WHERE d.id=? AND (d.is_public=TRUE OR d.owner_id=?) ORDER BY dv.position,w.term LIMIT 500`,[req.user?.id||0,req.params.id,req.user?.id||0]);
    res.json(rows);
  }));
  app.get('/api/v1/my-decks',requireUser,api(async(req,res)=>{const [rows]=await db.execute(`SELECT d.id,d.name,d.slug,d.description,d.level,d.goal,d.category,d.is_public,COUNT(dv.vocabulary_id) AS word_count FROM decks d LEFT JOIN deck_vocabularies dv ON dv.deck_id=d.id WHERE d.owner_id=? GROUP BY d.id ORDER BY d.updated_at DESC`,[req.user.id]);res.json(rows);}));
  app.post('/api/v1/my-decks',requireUser,api(async(req,res)=>{
    const name=String(req.body.name||'').trim();const description=String(req.body.description||'').trim();const level=req.body.level||null;const goal=String(req.body.goal||'general');const category=String(req.body.category||'general');
    if(name.length<2||name.length>140)throw fail('Tên bộ từ cần có từ 2 đến 140 ký tự.');if(level&&!['A1','A2','B1','B2','C1','C2'].includes(level))throw fail('Trình độ CEFR không hợp lệ.');
    const slug=`user-${req.user.id}-${randomBytes(8).toString('hex')}`;const [r]=await db.execute('INSERT INTO decks(owner_id,name,slug,description,level,goal,category,is_public) VALUES(?,?,?,?,?,?,?,FALSE)',[req.user.id,name,slug,description,level,goal,category]);res.status(201).json({id:r.insertId,name,slug,description,level,goal,category,is_public:0,word_count:0});
  }));
  app.patch('/api/v1/my-decks/:id',requireUser,api(async(req,res)=>{const name=String(req.body.name||'').trim();const description=String(req.body.description||'').trim();if(name.length<2||name.length>140)throw fail('Tên bộ từ cần có từ 2 đến 140 ký tự.');const [r]=await db.execute('UPDATE decks SET name=?,description=? WHERE id=? AND owner_id=? AND is_public=FALSE',[name,description,req.params.id,req.user.id]);if(!r.affectedRows)throw fail('Không tìm thấy bộ từ cá nhân.',404);res.json({ok:true});}));
  app.delete('/api/v1/my-decks/:id',requireUser,api(async(req,res)=>{const [r]=await db.execute('DELETE FROM decks WHERE id=? AND owner_id=? AND is_public=FALSE',[req.params.id,req.user.id]);if(!r.affectedRows)throw fail('Không tìm thấy bộ từ cá nhân.',404);res.json({ok:true});}));
  app.post('/api/v1/my-decks/:id/vocabularies',requireUser,api(async(req,res)=>{const id=Number(req.body.vocabulary_id);const [[deck]]=await db.execute('SELECT id FROM decks WHERE id=? AND owner_id=? AND is_public=FALSE',[req.params.id,req.user.id]);if(!deck)throw fail('Không tìm thấy bộ từ cá nhân.',404);const [[word]]=await db.execute('SELECT id FROM words WHERE id=?',[id]);if(!word)throw fail('Không tìm thấy từ vựng.',404);await db.execute('INSERT IGNORE INTO deck_vocabularies(deck_id,vocabulary_id,position) VALUES(?,?,?)',[req.params.id,id,Date.now()%2_000_000_000]);res.status(201).json({ok:true});}));
  app.delete('/api/v1/my-decks/:id/vocabularies/:vocabularyId',requireUser,api(async(req,res)=>{await db.execute('DELETE dv FROM deck_vocabularies dv JOIN decks d ON d.id=dv.deck_id WHERE d.id=? AND d.owner_id=? AND d.is_public=FALSE AND dv.vocabulary_id=?',[req.params.id,req.user.id,req.params.vocabularyId]);res.json({ok:true});}));

  app.post('/api/v1/study-sessions',requireUser,api(async(req,res)=>{
    const requestedDeck=req.body.deck_id?Number(req.body.deck_id):null;const deckId=requestedDeck>0?requestedDeck:null;const type=req.body.session_type||'learn';if(!['learn','review','free'].includes(type))throw fail('Loại phiên học không hợp lệ.');
    if(deckId){const [[deck]]=await db.execute('SELECT id FROM decks WHERE id=? AND (is_public=TRUE OR owner_id=?)',[deckId,req.user.id]);if(!deck)throw fail('Không tìm thấy bộ từ.',404);}
    let deckClause='';const vals=[req.user.id];if(deckId){deckClause=' AND d.id=? AND (d.is_public=TRUE OR d.owner_id=?)';vals.push(deckId,req.user.id);}
    let dueClause='';if(type==='review')dueClause=' AND p.due_at<=UTC_TIMESTAMP(3)';else if(type==='learn')dueClause=' AND (p.vocabulary_id IS NULL OR p.status="new" OR p.due_at<=UTC_TIMESTAMP(3))';
    const [cards]=await db.execute(`SELECT DISTINCT w.id,w.term,w.part_of_speech,w.pronunciation,w.meaning,w.example,w.translation,w.image,p.vocabulary_id,p.status,p.due_at,p.interval_days,p.repetitions
      FROM decks d JOIN deck_vocabularies dv ON dv.deck_id=d.id JOIN words w ON w.id=dv.vocabulary_id LEFT JOIN user_vocabulary_progress p ON p.vocabulary_id=w.id AND p.user_id=?
      WHERE (d.is_public=TRUE OR d.owner_id=?)${deckClause}${dueClause} ORDER BY CASE WHEN p.vocabulary_id IS NULL THEN 0 ELSE 1 END,COALESCE(p.due_at,UTC_TIMESTAMP(3)),RAND() LIMIT 100`,[req.user.id,req.user.id,...vals.slice(1)]);
    if(!cards.length&&!deckId)throw fail('Không có thẻ nào trong thư viện để học.',404);
    const conn=await db.getConnection();let sessionId;try{await conn.beginTransaction();const [result]=await conn.execute('INSERT INTO study_sessions(user_id,deck_id,session_type) VALUES(?,?,?)',[req.user.id,deckId,type]);sessionId=result.insertId;for(const card of cards)await conn.execute('INSERT INTO study_session_cards(session_id,vocabulary_id) VALUES(?,?)',[sessionId,card.id]);await conn.commit();}catch(e){await conn.rollback();throw e;}finally{conn.release();}res.status(201).json({id:sessionId,session_type:type,cards,cards_reviewed:0});
  }));
  app.get('/api/v1/study-sessions/:id',requireUser,api(async(req,res)=>{const [[session]]=await db.execute('SELECT id,deck_id,session_type,started_at,ended_at,cards_reviewed,correct_count FROM study_sessions WHERE id=? AND user_id=?',[req.params.id,req.user.id]);if(!session)throw fail('Không tìm thấy phiên học.',404);res.json(session);}));
  app.post('/api/v1/study-sessions/:id/reveal',requireUser,api(async(req,res)=>{const [[session]]=await db.execute('SELECT id,ended_at FROM study_sessions WHERE id=? AND user_id=?',[req.params.id,req.user.id]);if(!session)throw fail('Không tìm thấy phiên học.',404);if(session.ended_at)throw fail('Phiên học này đã kết thúc.',409);const [result]=await db.execute('UPDATE study_session_cards SET revealed_at=COALESCE(revealed_at,UTC_TIMESTAMP(3)) WHERE session_id=? AND vocabulary_id=?',[req.params.id,Number(req.body.vocabulary_id)]);if(!result.affectedRows)throw fail('Thẻ này không thuộc phiên học.',403);res.json({ok:true});}));
  app.post('/api/v1/study-sessions/:id/reviews',requireUser,api(async(req,res)=>{
    const vocabularyId=Number(req.body.vocabulary_id);const rating=String(req.body.rating||'');if(!Number.isSafeInteger(vocabularyId)||!['again','hard','good','easy'].includes(rating))throw fail('Thẻ hoặc mức đánh giá không hợp lệ.');
    const conn=await db.getConnection();try{await conn.beginTransaction();const [[session]]=await conn.execute('SELECT * FROM study_sessions WHERE id=? AND user_id=? FOR UPDATE',[req.params.id,req.user.id]);if(!session)throw fail('Không tìm thấy phiên học.',404);if(session.ended_at)throw fail('Phiên học này đã kết thúc.',409);if(session.session_type==='free')throw fail('Ôn tự do không thay đổi lịch ôn.',409);
      const [[allowed]]=await conn.execute('SELECT revealed_at,reviewed_at FROM study_session_cards WHERE session_id=? AND vocabulary_id=? FOR UPDATE',[session.id,vocabularyId]);if(!allowed)throw fail('Thẻ này không thuộc phiên học.',403);if(!allowed.revealed_at)throw fail('Hãy xem đáp án trước khi đánh giá thẻ.',409);
      const [[prior]]=await conn.execute('SELECT id FROM review_history WHERE session_id=? AND vocabulary_id=?',[session.id,vocabularyId]);if(prior)throw fail('Thẻ này đã được ghi nhận trong phiên học.',409);
      const [[old]]=await conn.execute('SELECT * FROM user_vocabulary_progress WHERE user_id=? AND vocabulary_id=? FOR UPDATE',[req.user.id,vocabularyId]);const previous=old||{interval_days:0,repetitions:0};const next=schedule(previous.interval_days,rating);const reps=Number(previous.repetitions||0)+1;
      const status=rating==='again'?'learning':reps>=6&&next.days>=30?'mastered':reps<3?'learning':'review';
      await conn.execute(`INSERT INTO user_vocabulary_progress(user_id,vocabulary_id,status,repetitions,interval_days,due_at,last_reviewed_at) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE status=VALUES(status),repetitions=VALUES(repetitions),interval_days=VALUES(interval_days),due_at=VALUES(due_at),last_reviewed_at=VALUES(last_reviewed_at)`,[req.user.id,vocabularyId,status,reps,next.days,next.due]);
      await conn.execute('INSERT INTO review_history(user_id,vocabulary_id,deck_id,session_id,rating,due_at) VALUES(?,?,?,?,?,?)',[req.user.id,vocabularyId,session.deck_id,session.id,rating,next.due]);await conn.execute('UPDATE study_session_cards SET reviewed_at=UTC_TIMESTAMP(3) WHERE session_id=? AND vocabulary_id=?',[session.id,vocabularyId]);
      await conn.execute('UPDATE study_sessions SET cards_reviewed=cards_reviewed+1,correct_count=correct_count+? WHERE id=?',[rating==='again'?0:1,session.id]);await conn.commit();res.json({due_at:next.due,interval_days:next.days,status});
    }catch(e){await conn.rollback();throw e;}finally{conn.release();}
  }));
  app.post('/api/v1/study-sessions/:id/complete',requireUser,api(async(req,res)=>{const [r]=await db.execute('UPDATE study_sessions SET ended_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=? AND ended_at IS NULL',[req.params.id,req.user.id]);if(!r.affectedRows){const [[s]]=await db.execute('SELECT cards_reviewed,correct_count,ended_at FROM study_sessions WHERE id=? AND user_id=?',[req.params.id,req.user.id]);if(!s)throw fail('Không tìm thấy phiên học.',404);return res.json(s);}const [[s]]=await db.execute('SELECT cards_reviewed,correct_count,ended_at FROM study_sessions WHERE id=? AND user_id=?',[req.params.id,req.user.id]);res.json(s);}));
  app.get('/api/v1/reviews/due',requireUser,api(async(req,res)=>{const [rows]=await db.execute(`SELECT d.id AS deck_id,d.name AS deck_name,COUNT(DISTINCT p.vocabulary_id) AS due_count FROM user_vocabulary_progress p JOIN deck_vocabularies dv ON dv.vocabulary_id=p.vocabulary_id JOIN decks d ON d.id=dv.deck_id WHERE p.user_id=? AND p.due_at<=UTC_TIMESTAMP(3) AND (d.is_public=TRUE OR d.owner_id=?) GROUP BY d.id ORDER BY due_count DESC`,[req.user.id,req.user.id]);const [[count]]=await db.execute(`SELECT COUNT(*) AS total FROM user_vocabulary_progress WHERE user_id=? AND due_at<=UTC_TIMESTAMP(3)`,[req.user.id]);res.json({total:Number(count.total),decks:rows});}));
  app.get('/api/v1/progress/summary',requireUser,api(async(req,res)=>{const [[stats]]=await db.execute(`SELECT COUNT(*) AS encountered,SUM(status IN ('learning','review')) AS learning,SUM(status='mastered') AS mastered,SUM(due_at<=UTC_TIMESTAMP(3)) AS due FROM user_vocabulary_progress WHERE user_id=?`,[req.user.id]);const [[today]]=await db.execute(`SELECT COUNT(*) AS reviews FROM review_history WHERE user_id=? AND reviewed_at>=UTC_DATE()`,[req.user.id]);res.json({...stats,encountered:Number(stats.encountered),learning:Number(stats.learning||0),mastered:Number(stats.mastered||0),due:Number(stats.due||0),today:Number(today.reviews||0)});}));
  app.get('/api/v1/progress/history',requireUser,api(async(req,res)=>{const [rows]=await db.execute(`SELECT DATE(reviewed_at) AS day,COUNT(*) AS reviews,SUM(rating<>'again') AS remembered FROM review_history WHERE user_id=? AND reviewed_at>=DATE_SUB(UTC_DATE(),INTERVAL 29 DAY) GROUP BY DATE(reviewed_at) ORDER BY day`,[req.user.id]);res.json(rows);}));
  app.get('/api/v1/decks/:id/progress',requireUser,api(async(req,res)=>{const [[row]]=await db.execute(`SELECT COUNT(*) AS total,COUNT(p.vocabulary_id) AS encountered,SUM(p.due_at<=UTC_TIMESTAMP(3)) AS due,SUM(p.status='mastered') AS mastered FROM deck_vocabularies dv LEFT JOIN user_vocabulary_progress p ON p.vocabulary_id=dv.vocabulary_id AND p.user_id=? WHERE dv.deck_id=?`,[req.user.id,req.params.id]);res.json(row);}));
  app.get('/api/v1/dashboard',requireUser,api(async(req,res)=>{const [[stats]]=await db.execute(`SELECT COUNT(*) AS encountered,SUM(status IN ('learning','review')) AS learning,SUM(status='mastered') AS mastered,SUM(due_at<=UTC_TIMESTAMP(3)) AS due FROM user_vocabulary_progress WHERE user_id=?`,[req.user.id]);const [[today]]=await db.execute(`SELECT COUNT(*) AS reviews FROM review_history WHERE user_id=? AND reviewed_at>=UTC_DATE()`,[req.user.id]);const [history]=await db.execute(`SELECT DATE(reviewed_at) AS day,COUNT(*) AS reviews FROM review_history WHERE user_id=? AND reviewed_at>=DATE_SUB(UTC_DATE(),INTERVAL 6 DAY) GROUP BY DATE(reviewed_at) ORDER BY day`,[req.user.id]);const [recent]=await db.execute(`SELECT d.id,d.name,COUNT(r.id) AS reviews,MAX(r.reviewed_at) AS last_studied FROM review_history r LEFT JOIN decks d ON d.id=r.deck_id WHERE r.user_id=? GROUP BY d.id,d.name ORDER BY last_studied DESC LIMIT 5`,[req.user.id]);const [[sessions]]=await db.execute(`SELECT COUNT(*) AS completed FROM study_sessions WHERE user_id=? AND ended_at IS NOT NULL`,[req.user.id]);const [ratings]=await db.execute(`SELECT rating,COUNT(*) AS count FROM review_history WHERE user_id=? GROUP BY rating ORDER BY FIELD(rating,'again','hard','good','easy')`,[req.user.id]);const [dates]=await db.execute(`SELECT DISTINCT DATE(reviewed_at) AS day FROM review_history WHERE user_id=? AND reviewed_at>=DATE_SUB(UTC_DATE(),INTERVAL 60 DAY) ORDER BY day DESC`,[req.user.id]);let streak=0;if(dates.length){let cursor=new Date();cursor.setUTCHours(0,0,0,0);const todayKey=cursor.toISOString().slice(0,10);if(String(dates[0].day).slice(0,10)!==todayKey)cursor.setUTCDate(cursor.getUTCDate()-1);const keys=new Set(dates.map(x=>String(x.day).slice(0,10)));while(keys.has(cursor.toISOString().slice(0,10))){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}}res.json({stats:{...stats,today:Number(today.reviews||0),sessions:Number(sessions.completed||0),streak},history,recent,ratings});}));
}
