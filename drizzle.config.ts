import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Allow build to proceed without DATABASE_URL (it's only needed at runtime)
const databaseUrl = process.env.DATABASE_URL || 'file:./local.db';
const databaseAuthToken = process.env.DATABASE_AUTH_TOKEN;

// Debug output
console.log('[DRIZZLE CONFIG] Database URL:', databaseUrl ? `${databaseUrl.substring(0, 30)}...` : 'NOT SET');
console.log('[DRIZZLE CONFIG] Auth Token:', databaseAuthToken ? `${databaseAuthToken.substring(0, 20)}...` : 'NOT SET');

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
