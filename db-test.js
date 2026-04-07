import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

(async () => {
  const db = await open({
    filename: './users.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      passwordHash TEXT,
      pfpLink TEXT,
      role TEXT DEFAULT 'user',
      createdAt TEXT
    )
  `);

  console.log("SQLite connected and users table ready!");
})();