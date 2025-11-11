import { db } from '$lib/server/db';
import { algorandTransaction, roastingData, processingData } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		// Fetch transactions with their roasting data, ordered by timestamp descending (newest first)
		const transactions = await db
			.select({
				id: algorandTransaction.id,
				txId: algorandTransaction.txId,
				round: algorandTransaction.round,
				timestamp: algorandTransaction.timestamp,
				noteDecoded: algorandTransaction.noteDecoded,
				sender: algorandTransaction.sender,
				receiver: algorandTransaction.receiver,
				amount: algorandTransaction.amount,
				// Roasting data fields
				productionBatchId: roastingData.productionBatchId,
				typeOfRoast: roastingData.typeOfRoast,
				locationOfRoastingPlant: roastingData.locationOfRoastingPlant,
				kgCoffeeRoasted: roastingData.kgCoffeeRoasted,
				roastDate: roastingData.roastDate,
				zone1CoffeeSpecies: roastingData.zone1CoffeeSpecies,
				zone2CoffeeSpecies: roastingData.zone2CoffeeSpecies,
				zone1HarvestBegin: roastingData.zone1HarvestBegin,
				zone1HarvestEnd: roastingData.zone1HarvestEnd,
				zone2HarvestBegin: roastingData.zone2HarvestBegin,
				zone2HarvestEnd: roastingData.zone2HarvestEnd,
				childTx: roastingData.childTx,
				// Processing data fields
				qtyGreenCoffee: processingData.qtyGreenCoffee,
				sortEntry: processingData.sortEntry,
				sortExit: processingData.sortExit,
				processingHarvestBegin: processingData.harvestBegin,
				processingHarvestEnd: processingData.harvestEnd
			})
			.from(algorandTransaction)
			.leftJoin(roastingData, eq(algorandTransaction.id, roastingData.transactionId))
			.leftJoin(processingData, eq(algorandTransaction.id, processingData.transactionId))
			.orderBy(desc(algorandTransaction.timestamp));

		return {
			transactions
		};
	} catch (error) {
		console.error('Error loading transactions:', error);
		console.error('Error details:', {
			name: error instanceof Error ? error.name : 'Unknown',
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined
		});
		throw error; // Re-throw to see the full error in logs
	}
};
