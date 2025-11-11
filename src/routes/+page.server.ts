import { db } from '$lib/server/db';
import { algorandTransaction, roastingData } from '$lib/server/db/schema';
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
				childTx: roastingData.childTx
			})
			.from(algorandTransaction)
			.leftJoin(roastingData, eq(algorandTransaction.id, roastingData.transactionId))
			.orderBy(desc(algorandTransaction.timestamp));

		return {
			transactions
		};
	} catch (error) {
		console.error('Error loading transactions:', error);
		return {
			transactions: []
		};
	}
};
