#!/usr/bin/env tsx
/**
 * Analyze Transaction Notes Script
 *
 * Extracts all transaction notes and analyzes their patterns
 * to identify what data might not be getting parsed correctly.
 *
 * Usage:
 *   npm run analyze:notes
 */

import { db } from '../src/lib/server/db/cli';
import { algorandTransaction } from '../src/lib/server/db/schema';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
	console.log('='.repeat(60));
	console.log('ANALYZE TRANSACTION NOTES');
	console.log('='.repeat(60));
	console.log('');

	try {
		// Get all transactions with notes
		const transactions = await db
			.select({
				txId: algorandTransaction.txId,
				noteDecoded: algorandTransaction.noteDecoded
			})
			.from(algorandTransaction);

		console.log(`Found ${transactions.length} total transactions`);

		// Filter transactions with notes
		const withNotes = transactions.filter((tx) => tx.noteDecoded && tx.noteDecoded.trim());
		console.log(`Found ${withNotes.length} transactions with notes`);
		console.log('');

		// Write all notes to a file
		const outputPath = path.join(process.cwd(), 'transaction-notes.txt');
		let output = '';

		output += '=' .repeat(80) + '\n';
		output += 'ALL TRANSACTION NOTES\n';
		output += '='.repeat(80) + '\n\n';

		for (const tx of withNotes) {
			output += '-'.repeat(80) + '\n';
			output += `Transaction ID: ${tx.txId}\n`;
			output += '-'.repeat(80) + '\n';
			output += tx.noteDecoded + '\n';
			output += '\n\n';
		}

		fs.writeFileSync(outputPath, output, 'utf-8');
		console.log(`✓ Wrote all notes to: ${outputPath}`);
		console.log('');

		// Analyze patterns
		console.log('='.repeat(60));
		console.log('PATTERN ANALYSIS');
		console.log('='.repeat(60));
		console.log('');

		const patterns = {
			hasParentCompanyId: 0,
			hasProductionBatchId: 0,
			hasRoasting: 0,
			hasProcessing: 0,
			hasTypeOfRoast: 0,
			hasLocation: 0,
			hasKgRoasted: 0,
			hasRoastDate: 0,
			hasZone1: 0,
			hasZone2: 0,
			hasZone3: 0,
			hasZone4: 0,
			hasZone5Plus: 0,
			hasCoffeeSpecies: 0,
			hasCoffeeSpeciesAndProcess: 0,
			hasHarvestBegin: 0,
			hasHarvestEnd: 0,
			hasChildTx: 0,
			hasReceptionIds: 0
		};

		const uniqueKeywords = new Set<string>();

		for (const tx of withNotes) {
			const note = tx.noteDecoded!;

			// Count patterns
			if (/PARENT COMPANY ID:/i.test(note)) patterns.hasParentCompanyId++;
			if (/Production_Batch_ID:/i.test(note)) patterns.hasProductionBatchId++;
			if (/ROASTING/i.test(note)) patterns.hasRoasting++;
			if (/PROCESSING/i.test(note)) patterns.hasProcessing++;
			if (/Type of roast:/i.test(note)) patterns.hasTypeOfRoast++;
			if (/Location of roasting plant:/i.test(note)) patterns.hasLocation++;
			if (/Kg of coffee roasted:/i.test(note)) patterns.hasKgRoasted++;
			if (/Roast date:/i.test(note)) patterns.hasRoastDate++;
			if (/ZONE 1/i.test(note)) patterns.hasZone1++;
			if (/ZONE 2/i.test(note)) patterns.hasZone2++;
			if (/ZONE 3/i.test(note)) patterns.hasZone3++;
			if (/ZONE 4/i.test(note)) patterns.hasZone4++;
			if (/ZONE [5-9]/i.test(note) || /ZONE \d{2}/i.test(note)) patterns.hasZone5Plus++;
			if (/Coffee Species:/i.test(note)) patterns.hasCoffeeSpecies++;
			if (/Coffee Species & Process:/i.test(note)) patterns.hasCoffeeSpeciesAndProcess++;
			if (/Harvest begin:/i.test(note)) patterns.hasHarvestBegin++;
			if (/Harvest end:/i.test(note)) patterns.hasHarvestEnd++;
			if (/Child_TX/i.test(note)) patterns.hasChildTx++;
			if (/Reception IDs:/i.test(note)) patterns.hasReceptionIds++;

			// Extract all field names (lines ending with colon)
			const fieldMatches = note.matchAll(/^([A-Za-z][A-Za-z0-9\s_&]+):/gm);
			for (const match of fieldMatches) {
				uniqueKeywords.add(match[1].trim());
			}
		}

		// Print statistics
		console.log('Field Occurrences:');
		console.log('-'.repeat(60));
		for (const [key, count] of Object.entries(patterns)) {
			const percentage = ((count / withNotes.length) * 100).toFixed(1);
			console.log(`${key.padEnd(30)} ${count.toString().padStart(5)} (${percentage}%)`);
		}

		console.log('');
		console.log('Unique Field Names Found:');
		console.log('-'.repeat(60));
		const sortedKeywords = Array.from(uniqueKeywords).sort();
		for (const keyword of sortedKeywords) {
			console.log(`  - ${keyword}`);
		}

		console.log('');
		console.log('='.repeat(60));
		console.log('SAMPLE NOTES BY TYPE');
		console.log('='.repeat(60));
		console.log('');

		// Show sample of each type
		const roastingSample = withNotes.find((tx) => /ROASTING/i.test(tx.noteDecoded!));
		const processingSample = withNotes.find((tx) => /PROCESSING/i.test(tx.noteDecoded!));
		const otherSample = withNotes.find(
			(tx) => !/ROASTING/i.test(tx.noteDecoded!) && !/PROCESSING/i.test(tx.noteDecoded!)
		);

		if (roastingSample) {
			console.log('ROASTING Transaction Sample:');
			console.log('-'.repeat(60));
			console.log(roastingSample.noteDecoded?.substring(0, 400) + '...');
			console.log('');
		}

		if (processingSample) {
			console.log('PROCESSING Transaction Sample:');
			console.log('-'.repeat(60));
			console.log(processingSample.noteDecoded?.substring(0, 400) + '...');
			console.log('');
		}

		if (otherSample) {
			console.log('Other Transaction Sample:');
			console.log('-'.repeat(60));
			console.log(otherSample.noteDecoded?.substring(0, 400) + '...');
			console.log('');
		}

		console.log('='.repeat(60));
		console.log('ANALYSIS COMPLETE');
		console.log('='.repeat(60));
		console.log('');
		console.log(`Full notes saved to: ${outputPath}`);
		console.log('Review the file to see all transaction patterns.');
		console.log('');

		process.exit(0);
	} catch (error) {
		console.error('');
		console.error('='.repeat(60));
		console.error('FATAL ERROR');
		console.error('='.repeat(60));
		console.error(error);
		console.error('='.repeat(60));
		process.exit(1);
	}
}

main();
