import { json } from '@sveltejs/kit';
import { syncHistoricalTransactions } from '$lib/server/historical-sync';
import type { RequestHandler } from './$types';

/**
 * POST /api/sync/historical
 * Triggers a full historical sync of all Lavazza Algorand transactions
 *
 * WARNING: This can take a long time depending on the number of transactions.
 * Consider running this as a background task or CLI script instead.
 *
 * Optional: Add authentication header to secure this endpoint
 */
export const POST: RequestHandler = async ({ request }) => {
	// Optional: Add authentication
	// const authHeader = request.headers.get('authorization');
	// if (authHeader !== `Bearer ${env.SYNC_SECRET}`) {
	// 	return json({ error: 'Unauthorized' }, { status: 401 });
	// }

	try {
		console.log('[API] Historical sync endpoint called');

		// Get optional parameters from request body
		const body = await request.json().catch(() => ({}));
		const batchSize = body.batchSize || 100;
		const delayBetweenBatches = body.delayBetweenBatches || 100;

		const result = await syncHistoricalTransactions(batchSize, delayBetweenBatches);

		if (!result.success) {
			return json(
				{
					success: false,
					error: result.error,
					totalTransactions: result.totalTransactions,
					pagesProcessed: result.pagesProcessed
				},
				{ status: 500 }
			);
		}

		return json({
			success: true,
			totalTransactions: result.totalTransactions,
			pagesProcessed: result.pagesProcessed,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('[API] Historical sync endpoint error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
