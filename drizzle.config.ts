import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

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
