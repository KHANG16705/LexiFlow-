CREATE TABLE topics (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 language ENUM('en','zh') NOT NULL,
 name VARCHAR(120) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY language_name(language,name),
 UNIQUE KEY id_language(id,language)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO topics(language,name) SELECT DISTINCT language,'Từ chưa phân loại' FROM words;
ALTER TABLE words ADD COLUMN topic_id INT UNSIGNED NULL AFTER language;
UPDATE words w JOIN topics t ON t.language=w.language AND t.name='Từ chưa phân loại' SET w.topic_id=t.id;
ALTER TABLE words MODIFY topic_id INT UNSIGNED NOT NULL;
ALTER TABLE words DROP INDEX language_term;
ALTER TABLE words ADD UNIQUE KEY topic_term(topic_id,term);
ALTER TABLE words ADD KEY topic_language(topic_id,language);
ALTER TABLE words ADD CONSTRAINT words_topic_language FOREIGN KEY(topic_id,language) REFERENCES topics(id,language) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE TABLE schema_migrations (version VARCHAR(80) PRIMARY KEY,applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) CHARACTER SET utf8mb4;
INSERT INTO schema_migrations(version) VALUES('0001_topics');
