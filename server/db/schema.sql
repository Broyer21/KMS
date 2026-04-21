CREATE DATABASE IF NOT EXISTS metatinis_auth;
USE metatinis_auth;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NULL,
  oauth_provider VARCHAR(32) NOT NULL DEFAULT 'local',
  google_sub VARCHAR(128) NULL UNIQUE,
  display_name VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  token VARCHAR(128) NOT NULL UNIQUE,
  user_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS verification_codes (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used_at DATETIME NULL,
  resend_allowed_at DATETIME NOT NULL,
  INDEX idx_verification_email (email),
  INDEX idx_verification_expires (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS oauth_states (
  id VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  state_token VARCHAR(128) NOT NULL UNIQUE,
  nonce_token VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  INDEX idx_oauth_state_provider (provider),
  INDEX idx_oauth_state_expires (expires_at)
) ENGINE=InnoDB;
