CREATE DATABASE IF NOT EXISTS flashcardbyk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'flashcardbyk'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
GRANT ALL PRIVILEGES ON flashcardbyk.* TO 'flashcardbyk'@'localhost';
