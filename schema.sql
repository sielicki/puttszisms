CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  attributed_to TEXT NOT NULL DEFAULT 'Puttsz',
  context TEXT,
  date_said TEXT NOT NULL,
  submitted_by TEXT NOT NULL REFERENCES users(discord_id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ratings (
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(discord_id),
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  PRIMARY KEY (quote_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(discord_id),
  text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
