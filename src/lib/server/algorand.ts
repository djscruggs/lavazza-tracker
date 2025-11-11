import algosdk from 'algosdk';

// AlgoNode free indexer endpoints
const INDEXER_SERVER = 'https://mainnet-idx.algonode.cloud';
const INDEXER_PORT = '';
const INDEXER_TOKEN = '';

// Initialize the indexer client
const indexerClient = new algosdk.Indexer(INDEXER_TOKEN, INDEXER_SERVER, INDEXER_PORT);

// Lavazza Algorand address
export const LAVAZZA_ADDRESS = 'IHUIX3OSTQO7DQ77SOQ66IR6WVQ5PAFGTBF4TBEC36IUSLGU7O3KD6TJ4E';

export interface AlgorandTransaction {
	id: string;
	round: number;
	timestamp: number;
	note?: string;
	noteDecoded?: string;
	sender?: string;
	receiver?: string;
	amount?: number;
	fee?: number;
	txType?: string;
}

/**
 * Fetches transactions for a given address
 * @param address - Algorand address to query
 * @param minRound - Optional minimum round to start from (for incremental updates)
 * @param limit - Maximum number of transactions to fetch (default 100)
 */
export async function getTransactionsForAddress(
	address: string,
	minRound?: number,
	limit = 100
): Promise<AlgorandTransaction[]> {
	try {
		let query = indexerClient.lookupAccountTransactions(address).limit(limit);

		if (minRound) {
			query = query.minRound(minRound);
		}

		const response = await query.do();
		const transactions = response.transactions || [];

		return transactions.map((tx: any) => ({
			id: tx.id,
			round: tx['confirmed-round'],
			timestamp: tx['round-time'],
			note: tx.note,
			noteDecoded: tx.note ? decodeTransactionNote(tx.note) ?? undefined : undefined,
			sender: tx.sender,
			receiver: tx['payment-transaction']?.receiver,
			amount: tx['payment-transaction']?.amount,
			fee: tx.fee,
			txType: tx['tx-type']
		}));
	} catch (error) {
		console.error('Error fetching Algorand transactions:', error);
		throw error;
	}
}

/**
 * Decodes a base64-encoded transaction note to UTF-8 string
 * @param noteBase64 - Base64 encoded note from Algorand transaction
 */
export function decodeTransactionNote(noteBase64: string): string | null {
	if (!noteBase64) return null;

	try {
		const buff = Buffer.from(noteBase64, 'base64');
		return buff.toString('utf-8');
	} catch (error) {
		console.error('Error decoding transaction note:', error);
		return null;
	}
}

export interface RoastingData {
	parentCompanyId?: string;
	productionBatchId?: string;
	typeOfRoast?: string;
	locationOfRoastingPlant?: string;
	kgCoffeeRoasted?: string;
	roastDate?: string;
	zone1CoffeeSpecies?: string;
	zone1HarvestBegin?: string;
	zone1HarvestEnd?: string;
	zone2CoffeeSpecies?: string;
	zone2HarvestBegin?: string;
	zone2HarvestEnd?: string;
	childTx?: string;
}

/**
 * Parses roasting data from transaction note text
 * Handles multiple transaction types: ROASTING, PROCESSING, etc.
 * @param noteText - Decoded transaction note as UTF-8 string
 */
export function parseRoastingData(noteText: string): RoastingData | null {
	if (!noteText) return null;

	try {
		const data: RoastingData = {};

		// Define regex patterns for extracting structured data
		const patterns = {
			parentCompanyId: /PARENT COMPANY ID:\s*(\d+)/i,
			productionBatchId: /Production_Batch_ID:\s*(\S+)/i,
			typeOfRoast: /Type of roast:\s*([^\n]+)/i,
			locationOfRoastingPlant: /Location of roasting plant:\s*([^\n]+)/i,
			kgCoffeeRoasted: /Kg of coffee roasted:\s*([\d,.]+\s*Kg)/i,
			roastDate: /Roast date:\s*(\d{2}\/\d{2}\/\d{4})/i,
			childTx: /Child_TX\s*->\s*"([^"]+)"/i
		};

		// Extract main fields
		for (const [key, pattern] of Object.entries(patterns)) {
			const match = noteText.match(pattern);
			if (match) {
				data[key as keyof RoastingData] = match[1].trim();
			}
		}

		// Extract ZONE data dynamically (handles ZONE 1, 2, 3, 4, etc.)
		// We'll store the first two zones we find in zone1 and zone2 fields
		const zoneMatches = noteText.matchAll(/ZONE (\d+)([^]*?)(?=ZONE \d+|Child_TX|Process IDs:|Reception IDs:|$)/gi);
		const zones = Array.from(zoneMatches);

		// Helper function to extract zone data (handles multiple coffee species)
		function extractZoneData(zoneText: string) {
			// Find ALL Coffee Species entries (there can be multiple per zone)
			const speciesMatches = Array.from(
				zoneText.matchAll(/Coffee Species(?:\s*&\s*Process)?:\s*([^\n]+)/gi)
			);
			const species = speciesMatches.map((m) => m[1].trim()).filter(Boolean);

			// Get the first harvest dates (if any)
			const harvestBegin = zoneText.match(/Harvest begin:\s*(\d{2}\/\d{2}\/\d{4})/i);
			const harvestEnd = zoneText.match(/Harvest end:\s*(\d{2}\/\d{2}\/\d{4})/i);

			return {
				species: species.length > 0 ? species.join(', ') : null,
				harvestBegin: harvestBegin ? harvestBegin[1].trim() : null,
				harvestEnd: harvestEnd ? harvestEnd[1].trim() : null
			};
		}

		// Process first zone (map to zone1 fields)
		if (zones.length > 0) {
			const zone1Data = extractZoneData(zones[0][2]);
			if (zone1Data.species) data.zone1CoffeeSpecies = zone1Data.species;
			if (zone1Data.harvestBegin) data.zone1HarvestBegin = zone1Data.harvestBegin;
			if (zone1Data.harvestEnd) data.zone1HarvestEnd = zone1Data.harvestEnd;
		}

		// Process second zone (map to zone2 fields)
		if (zones.length > 1) {
			const zone2Data = extractZoneData(zones[1][2]);
			if (zone2Data.species) data.zone2CoffeeSpecies = zone2Data.species;
			if (zone2Data.harvestBegin) data.zone2HarvestBegin = zone2Data.harvestBegin;
			if (zone2Data.harvestEnd) data.zone2HarvestEnd = zone2Data.harvestEnd;
		}

		// Log what we extracted for debugging
		if (Object.keys(data).length > 0) {
			console.log(`[PARSE] Extracted ${Object.keys(data).length} fields:`, Object.keys(data));
		} else {
			console.log('[PARSE] No data extracted from note');
		}

		// Only return data if we extracted at least some fields
		return Object.keys(data).length > 0 ? data : null;
	} catch (error) {
		console.error('Error parsing roasting data:', error);
		return null;
	}
}

/**
 * Fetches new transactions since the last processed round
 * @param address - Algorand address to query
 * @param lastProcessedRound - Last round that was processed
 */
export async function fetchNewTransactions(
	address: string,
	lastProcessedRound?: number
): Promise<AlgorandTransaction[]> {
	const minRound = lastProcessedRound ? lastProcessedRound + 1 : undefined;
	return getTransactionsForAddress(address, minRound, 100);
}
