/**
 * Database connection for CLI scripts
 * Uses process.env directly instead of SvelteKit's $env
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set in environment variables');
}

const client = createClient({
	url: process.env.DATABASE_URL,
	authToken: process.env.DATABASE_AUTH_TOKEN
});

export const db = drizzle(client, { schema });
