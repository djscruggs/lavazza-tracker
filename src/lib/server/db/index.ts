import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

console.log('[DB] Initializing database client with URL:', env.DATABASE_URL?.substring(0, 20) + '...');

const client = createClient({
	url: env.DATABASE_URL,
	authToken: env.DATABASE_AUTH_TOKEN
});

console.log('[DB] Database client created successfully');

export const db = drizzle(client, { schema });
