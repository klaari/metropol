import { createDb } from "@metropol/db";

const databaseUrl = process.env.EXPO_PUBLIC_DATABASE_URL!;

export const db = createDb(databaseUrl);
