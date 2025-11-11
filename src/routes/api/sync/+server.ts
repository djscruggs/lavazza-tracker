import { json } from '@sveltejs/kit';
import { syncLavazzaTransactions } from '$lib/server/sync-service';
import type { RequestHandler } from './$types';

/**
 * POST /api/sync
 * Triggers a sync of Lavazza Algorand transactions
 *
 * This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions, or external service)
 * to run hourly and fetch new transactions from the Algorand blockchain.
 *
 * Optional: Add authentication header to secure this endpoint
 * Example: Check for a secret token in headers before allowing sync
 */
export const POST: RequestHandler = async ({ request }) => {
	// Optional: Add authentication
	// const authHeader = request.headers.get('authorization');
	// if (authHeader !== `Bearer ${env.SYNC_SECRET}`) {
	// 	return json({ error: 'Unauthorized' }, { status: 401 });
	// }

	try {
		console.log('[API] Sync endpoint called');
		const result = await syncLavazzaTransactions();

		if (!result.success) {
			return json(
				{
					success: false,
					error: result.error
				},
				{ status: 500 }
			);
		}

		return json({
			success: true,
			transactionsProcessed: result.transactionsProcessed,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('[API] Sync endpoint error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * GET /api/sync
 * Returns the current sync status
 */
export const GET: RequestHandler = async () => {
	try {
		// Import here to avoid circular dependencies
		const { db } = await import('$lib/server/db');
		const { syncStatus } = await import('$lib/server/db/schema');
		const { LAVAZZA_ADDRESS } = await import('$lib/server/algorand');

		const status = await db.select().from(syncStatus).limit(1);

		return json({
			address: LAVAZZA_ADDRESS,
			lastSync: status[0] || null,
			serverTime: new Date().toISOString()
		});
	} catch (error) {
		console.error('[API] Get sync status error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
