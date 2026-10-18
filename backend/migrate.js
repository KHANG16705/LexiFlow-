const version='0001_topics';

export async function migrate(db){
 await db.query("CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(80) PRIMARY KEY,applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) CHARACTER SET utf8mb4");
 const [[done]]=await db.execute('SELECT version FROM schema_migrations WHERE version=?',[version]);
 if(done){
  const [partOfSpeechColumn]=await db.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='words' AND COLUMN_NAME='part_of_speech'");
  if(!partOfSpeechColumn.length)await db.query("ALTER TABLE words ADD COLUMN part_of_speech VARCHAR(80) NOT NULL DEFAULT '' AFTER term");
  const [[detailsMigration]]=await db.execute('SELECT version FROM schema_migrations WHERE version=?',['0002_word_details']);
  if(!detailsMigration)await db.execute('INSERT INTO schema_migrations(version) VALUES(?)',['0002_word_details']);
  return;
 }
 await db.query(`CREATE TABLE IF NOT EXISTS topics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  language ENUM('en','zh') NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY language_name(language,name),
  UNIQUE KEY id_language(id,language)
 ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 const [partOfSpeechColumn]=await db.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='words' AND COLUMN_NAME='part_of_speech'");
 if(!partOfSpeechColumn.length)await db.query("ALTER TABLE words ADD COLUMN part_of_speech VARCHAR(80) NOT NULL DEFAULT '' AFTER term");
 const [[detailsMigration]]=await db.execute('SELECT version FROM schema_migrations WHERE version=?',['0002_word_details']);
 if(!detailsMigration)await db.execute('INSERT INTO schema_migrations(version) VALUES(?)',['0002_word_details']);
 await db.query("INSERT IGNORE INTO topics(language,name) SELECT DISTINCT language,'Từ chưa phân loại' FROM words");
 const [columns]=await db.execute(`SELECT COLUMN_NAME,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='words' AND COLUMN_NAME='topic_id'`);
 if(!columns.length)await db.query('ALTER TABLE words ADD COLUMN topic_id INT UNSIGNED NULL AFTER language');
 await db.query("UPDATE words w JOIN topics t ON t.language=w.language AND t.name='Từ chưa phân loại' SET w.topic_id=t.id WHERE w.topic_id IS NULL");
 if(!columns.length||columns[0].IS_NULLABLE==='YES')await db.query('ALTER TABLE words MODIFY topic_id INT UNSIGNED NOT NULL');
 const [indexes]=await db.query('SHOW INDEX FROM words');
 const indexNames=new Set(indexes.map(index=>index.Key_name));
 if(indexNames.has('language_term'))await db.query('ALTER TABLE words DROP INDEX language_term');
 if(!indexNames.has('topic_term'))await db.query('ALTER TABLE words ADD UNIQUE KEY topic_term(topic_id,term)');
 if(!indexNames.has('topic_language'))await db.query('ALTER TABLE words ADD KEY topic_language(topic_id,language)');
 const [foreignKeys]=await db.execute(`SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='words' AND CONSTRAINT_NAME='words_topic_language'`);
 if(!foreignKeys.length)await db.query('ALTER TABLE words ADD CONSTRAINT words_topic_language FOREIGN KEY(topic_id,language) REFERENCES topics(id,language) ON UPDATE RESTRICT ON DELETE RESTRICT');
 await db.execute('INSERT INTO schema_migrations(version) VALUES(?)',[version]);
 console.log('Database migration complete: topics and word details.');
}
