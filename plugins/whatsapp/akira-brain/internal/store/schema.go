package store

const schema = `
CREATE TABLE IF NOT EXISTS projects (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	description TEXT,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
	jid TEXT PRIMARY KEY,
	display_name TEXT,
	is_group INTEGER NOT NULL DEFAULT 0,
	first_seen_at INTEGER NOT NULL,
	last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_projects (
	contact_jid TEXT NOT NULL REFERENCES contacts(jid),
	project_id INTEGER NOT NULL REFERENCES projects(id),
	mapped_at INTEGER NOT NULL,
	backfill_status TEXT NOT NULL DEFAULT 'none',
	PRIMARY KEY (contact_jid, project_id)
);

CREATE TABLE IF NOT EXISTS messages (
	id TEXT PRIMARY KEY,
	chat_jid TEXT NOT NULL,
	project_id INTEGER,
	sender_jid TEXT,
	is_from_me INTEGER NOT NULL DEFAULT 0,
	timestamp INTEGER NOT NULL,
	type TEXT,
	body TEXT,
	caption TEXT,
	is_media INTEGER NOT NULL DEFAULT 0,
	mimetype TEXT,
	media_local_path TEXT,
	retention_class TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_project_ts ON messages(project_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_chat_ts ON messages(chat_jid, timestamp);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
	message_id UNINDEXED,
	chat_jid,
	body,
	tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS inbox_retention_config (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	max_messages_per_contact INTEGER NOT NULL DEFAULT 50
);
INSERT OR IGNORE INTO inbox_retention_config (id, max_messages_per_contact) VALUES (1, 50);
`
