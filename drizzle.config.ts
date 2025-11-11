import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Debug output - check process.env BEFORE applying fallbacks
console.log('[DRIZZLE CONFIG] Raw DATABASE_URL from process.env:', process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 30)}...` : 'NOT SET');
console.log('[DRIZZLE CONFIG] Raw DATABASE_AUTH_TOKEN from process.env:', process.env.DATABASE_AUTH_TOKEN ? `${process.env.DATABASE_AUTH_TOKEN.substring(0, 20)}...` : 'NOT SET');

// Allow build to proceed without DATABASE_URL (it's only needed at runtime)
const databaseUrl = process.env.DATABASE_URL || 'file:./local.db';
const databaseAuthToken = process.env.DATABASE_AUTH_TOKEN;

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: {
		url: databaseUrl,
		authToken: databaseAuthToken
	},
	verbose: true,
	strict: true
});
