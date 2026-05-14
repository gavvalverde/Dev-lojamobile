// app/services/DataBase.js
import * as SQLite from "expo-sqlite";

let db = null;

export async function getDatabase() {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync("locatech.db");

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS contatos (
      id TEXT PRIMARY KEY NOT NULL,
      nome TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      avatar TEXT,
      favorito INTEGER,
      categoria TEXT,
      sexo TEXT
    );
  `);

  return db;
}