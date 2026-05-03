import { createDb, type Database } from "@aani/db";

const databaseUrl = process.env.EXPO_PUBLIC_DATABASE_URL!;

// Lazy singleton — avoids running @neondatabase/serverless at module load time
// which can crash on React Native if crypto.subtle is accessed during init
let _db: Database | null = null;
export function getDb(): Database {
  if (!_db) _db = createDb(databaseUrl);
  return _db;
}
