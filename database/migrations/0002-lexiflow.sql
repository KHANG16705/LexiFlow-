-- Additive LexiFlow migration. Existing topics, words, review_log, and images stay intact.
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(64) PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY session_expiry(expires_at),
  CONSTRAINT auth_session_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS decks (
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deck_vocabularies (
  deck_id INT UNSIGNED NOT NULL,
  vocabulary_id INT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  added_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(deck_id,vocabulary_id),
  KEY deck_word_order(deck_id,position),
  CONSTRAINT deck_vocab_deck FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  CONSTRAINT deck_vocab_word FOREIGN KEY(vocabulary_id) REFERENCES words(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_vocabulary_progress (
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS study_sessions (
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS study_session_cards (
  session_id BIGINT UNSIGNED NOT NULL,
  vocabulary_id INT UNSIGNED NOT NULL,
  revealed_at DATETIME(3) NULL,
  reviewed_at DATETIME(3) NULL,
  PRIMARY KEY(session_id,vocabulary_id),
  CONSTRAINT session_card_session FOREIGN KEY(session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
  CONSTRAINT session_card_word FOREIGN KEY(vocabulary_id) REFERENCES words(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_history (
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
