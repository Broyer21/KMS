const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('./config');

let pool;
let initPromise;
const STORE_FILE = path.join(__dirname, '..', '..', 'data', 'store.json');

function isFileStoreMode() {
	return config.storeMode === 'file' || config.storeMode === 'json';
}

function normalizeStoreShape(data) {
	return {
		users: Array.isArray(data?.users) ? data.users : [],
		sessions: Array.isArray(data?.sessions) ? data.sessions : [],
		verificationCodes: Array.isArray(data?.verificationCodes) ? data.verificationCodes : [],
		oauthStates: Array.isArray(data?.oauthStates) ? data.oauthStates : []
	};
}

async function initializeFileStore() {
	const dir = path.dirname(STORE_FILE);
	await fs.mkdir(dir, { recursive: true });
	try {
		const raw = await fs.readFile(STORE_FILE, 'utf-8');
		const parsed = JSON.parse(raw || '{}');
		const normalized = normalizeStoreShape(parsed);
		await fs.writeFile(STORE_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
		await fs.writeFile(STORE_FILE, JSON.stringify(normalizeStoreShape({}), null, 2), 'utf-8');
	}
}

async function readFileStore() {
	const raw = await fs.readFile(STORE_FILE, 'utf-8');
	const parsed = JSON.parse(raw || '{}');
	return normalizeStoreShape(parsed);
}

async function writeFileStore(data) {
	const normalized = normalizeStoreShape(data || {});
	await fs.writeFile(STORE_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
}

function getPool() {
	if (!pool) {
		pool = mysql.createPool({
			host: config.mysql.host,
			port: config.mysql.port,
			user: config.mysql.user,
			password: config.mysql.password,
			database: config.mysql.database,
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0,
			dateStrings: true
		});
	}
	return pool;
}

async function initializeDatabase() {
	const db = getPool();
	await db.query(`
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
		) ENGINE=InnoDB
	`);

	await db.query(`ALTER TABLE users MODIFY password_hash TEXT NULL`);

	const [oauthProviderColumn] = await db.query(`SHOW COLUMNS FROM users LIKE 'oauth_provider'`);
	if (oauthProviderColumn.length === 0) {
		await db.query(`ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(32) NOT NULL DEFAULT 'local'`);
	}

	const [googleSubColumn] = await db.query(`SHOW COLUMNS FROM users LIKE 'google_sub'`);
	if (googleSubColumn.length === 0) {
		await db.query(`ALTER TABLE users ADD COLUMN google_sub VARCHAR(128) NULL UNIQUE`);
	}

	const [displayNameColumn] = await db.query(`SHOW COLUMNS FROM users LIKE 'display_name'`);
	if (displayNameColumn.length === 0) {
		await db.query(`ALTER TABLE users ADD COLUMN display_name VARCHAR(255) NULL`);
	}

	const [avatarUrlColumn] = await db.query(`SHOW COLUMNS FROM users LIKE 'avatar_url'`);
	if (avatarUrlColumn.length === 0) {
		await db.query(`ALTER TABLE users ADD COLUMN avatar_url TEXT NULL`);
	}

	await db.query(`
		CREATE TABLE IF NOT EXISTS sessions (
			id VARCHAR(64) PRIMARY KEY,
			token VARCHAR(128) NOT NULL UNIQUE,
			user_id VARCHAR(64) NOT NULL,
			created_at DATETIME NOT NULL,
			expires_at DATETIME NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB
	`);

	await db.query(`
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
		) ENGINE=InnoDB
	`);

	await db.query(`
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
		) ENGINE=InnoDB
	`);
}

async function ensureInitialized() {
	if (!initPromise) {
		initPromise = isFileStoreMode() ? initializeFileStore() : initializeDatabase();
	}
	await initPromise;
}

async function initializeStore() {
	await ensureInitialized();
}

function mapUserRow(row) {
	return {
		id: row.id,
		email: row.email,
		passwordHash: row.password_hash,
		oauthProvider: row.oauth_provider || 'local',
		googleSub: row.google_sub || null,
		displayName: row.display_name || null,
		avatarUrl: row.avatar_url || null,
		emailVerified: Boolean(row.email_verified),
		createdAt: new Date(row.created_at).toISOString()
	};
}

function mapSessionRow(row) {
	return {
		id: row.id,
		token: row.token,
		userId: row.user_id,
		createdAt: new Date(row.created_at).toISOString(),
		expiresAt: new Date(row.expires_at).toISOString()
	};
}

function mapVerificationRow(row) {
	return {
		id: row.id,
		email: row.email,
		codeHash: row.code_hash,
		createdAt: new Date(row.created_at).toISOString(),
		expiresAt: new Date(row.expires_at).toISOString(),
		attempts: Number(row.attempts),
		usedAt: row.used_at ? new Date(row.used_at).toISOString() : null,
		resendAllowedAt: new Date(row.resend_allowed_at).toISOString()
	};
}

function mapOauthStateRow(row) {
	return {
		id: row.id,
		provider: row.provider,
		stateToken: row.state_token,
		nonceToken: row.nonce_token,
		createdAt: new Date(row.created_at).toISOString(),
		expiresAt: new Date(row.expires_at).toISOString(),
		usedAt: row.used_at ? new Date(row.used_at).toISOString() : null
	};
}

async function readStore() {
	await ensureInitialized();

	if (isFileStoreMode()) {
		return readFileStore();
	}

	const db = getPool();

	const [usersRows] = await db.query('SELECT * FROM users');
	const [sessionRows] = await db.query('SELECT * FROM sessions');
	const [verificationRows] = await db.query('SELECT * FROM verification_codes');
	const [oauthStateRows] = await db.query('SELECT * FROM oauth_states');

	return {
		users: usersRows.map(mapUserRow),
		sessions: sessionRows.map(mapSessionRow),
		verificationCodes: verificationRows.map(mapVerificationRow),
		oauthStates: oauthStateRows.map(mapOauthStateRow)
	};
}

async function writeStore(data) {
	await ensureInitialized();

	if (isFileStoreMode()) {
		await writeFileStore(data);
		return;
	}

	const db = getPool();
	const connection = await db.getConnection();

	try {
		await connection.beginTransaction();

		await connection.query('DELETE FROM sessions');
		await connection.query('DELETE FROM verification_codes');
		await connection.query('DELETE FROM oauth_states');
		await connection.query('DELETE FROM users');

		for (const user of data.users || []) {
			await connection.query(
				`INSERT INTO users
					(id, email, password_hash, oauth_provider, google_sub, display_name, avatar_url, email_verified, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					user.id,
					user.email,
					user.passwordHash,
					user.oauthProvider || 'local',
					user.googleSub || null,
					user.displayName || null,
					user.avatarUrl || null,
					user.emailVerified ? 1 : 0,
					new Date(user.createdAt)
				]
			);
		}

		for (const session of data.sessions || []) {
			await connection.query(
				`INSERT INTO sessions (id, token, user_id, created_at, expires_at)
				 VALUES (?, ?, ?, ?, ?)`,
				[
					session.id,
					session.token,
					session.userId,
					new Date(session.createdAt),
					new Date(session.expiresAt)
				]
			);
		}

		for (const code of data.verificationCodes || []) {
			await connection.query(
				`INSERT INTO verification_codes
					(id, email, code_hash, created_at, expires_at, attempts, used_at, resend_allowed_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					code.id,
					code.email,
					code.codeHash,
					new Date(code.createdAt),
					new Date(code.expiresAt),
					Number(code.attempts || 0),
					code.usedAt ? new Date(code.usedAt) : null,
					new Date(code.resendAllowedAt)
				]
			);
		}

		for (const oauthState of data.oauthStates || []) {
			await connection.query(
				`INSERT INTO oauth_states
					(id, provider, state_token, nonce_token, created_at, expires_at, used_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					oauthState.id,
					oauthState.provider,
					oauthState.stateToken,
					oauthState.nonceToken,
					new Date(oauthState.createdAt),
					new Date(oauthState.expiresAt),
					oauthState.usedAt ? new Date(oauthState.usedAt) : null
				]
			);
		}

		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

module.exports = {
	initializeStore,
	readStore,
	writeStore
};
