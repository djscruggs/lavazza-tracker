<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatTime(timestamp: Date | null) {
		if (!timestamp) return 'N/A';
		return new Date(timestamp).toLocaleTimeString();
	}

	function formatAlgorandAmount(microAlgos: number | null) {
		if (!microAlgos) return 'N/A';
		return (microAlgos / 1_000_000).toFixed(2) + ' ALGO';
	}

	function truncateTxId(txId: string) {
		return txId.slice(0, 2) + '...' + txId.slice(-2);
	}

	function formatKgAmount(kgString: string | null) {
		if (!kgString) return '-';

		// Extract numeric value from string like "7.200,00 Kg" or "7200.00 Kg"
		// Remove "Kg" suffix and any spaces
		const numericPart = kgString.replace(/\s*Kg\s*/gi, '').trim();

		// Try to parse the number - handle both formats (European: 7.200,00 and US: 7,200.00)
		// Replace all dots and commas, then try to determine the format
		let number: number;

		// If there's a comma followed by exactly 2 digits at the end, it's likely a decimal separator
		if (/,\d{2}$/.test(numericPart)) {
			// European format: 7.200,00 -> replace dots (thousands) and comma (decimal)
			number = parseFloat(numericPart.replace(/\./g, '').replace(',', '.'));
		} else if (/\.\d{2}$/.test(numericPart)) {
			// US format: 7,200.00 -> remove commas
			number = parseFloat(numericPart.replace(/,/g, ''));
		} else {
			// Fallback: try to parse as-is
			number = parseFloat(numericPart.replace(/,/g, '.'));
		}

		if (isNaN(number)) return kgString; // Return original if parsing fails

		// Format using user's locale
		const formatter = new Intl.NumberFormat(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});

		return formatter.format(number) + ' Kg';
	}

	function formatHarvestPeriod(
		zone1Begin: string | null,
		zone1End: string | null,
		zone2Begin: string | null,
		zone2End: string | null
	) {
		const periods = [];

		if (zone1Begin && zone1End) {
			periods.push(`Z1: ${zone1Begin} - ${zone1End}`);
		}

		if (zone2Begin && zone2End) {
			periods.push(`Z2: ${zone2Begin} - ${zone2End}`);
		}

		return periods.length > 0 ? periods.join(' | ') : '-';
	}

	function formatDateOnly(timestamp: Date | null) {
		if (!timestamp) return '';
		return new Date(timestamp).toLocaleDateString();
	}

	// Group transactions by date
	type GroupedTransactions = {
		date: string;
		transactions: typeof data.transactions;
	};

	const groupedTransactions: GroupedTransactions[] = $derived.by(() => {
		const groups = new Map<string, typeof data.transactions>();

		for (const tx of data.transactions) {
			const dateKey = formatDateOnly(tx.timestamp);
			if (!groups.has(dateKey)) {
				groups.set(dateKey, []);
			}
			groups.get(dateKey)!.push(tx);
		}

		return Array.from(groups.entries()).map(([date, transactions]) => ({
			date,
			transactions
		}));
	});
</script>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold">Lavazza Coffee Transactions</h1>
		<p class="text-gray-600">Tracking roasting activity on the Algorand blockchain</p>
	</div>

	{#if data.transactions.length === 0}
		<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
			<p class="mb-2 font-medium text-yellow-800">No transactions found</p>
			<p class="text-sm text-yellow-600">
				Run a sync to fetch transactions: <code class="rounded bg-yellow-100 px-2 py-1"
					>curl -X POST /api/sync</code
				>
			</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="max-h-[calc(100vh-200px)] overflow-x-auto overflow-y-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="sticky top-0 z-20 bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Time
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Transaction ID
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Batch ID
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Roast Type
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Location
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Amount (Kg)
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Roast Date
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Harvest Period
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Coffee Species
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#each groupedTransactions as group}
							<!-- Date header row -->
							<tr class="sticky top-[55px] z-10 bg-blue-50">
								<td colspan="9" class="px-6 py-2 text-sm font-semibold text-blue-900">
									{group.date} ({group.transactions.length} transaction{group.transactions
										.length !== 1
										? 's'
										: ''})
								</td>
							</tr>
							<!-- Transaction rows for this date -->
							{#each group.transactions as tx}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{formatTime(tx.timestamp)}
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap">
										<div class="flex items-center gap-2">
											<a
												href="https://explorer.perawallet.app/tx/{tx.txId}"
												target="_blank"
												rel="noopener noreferrer"
												class="font-mono text-blue-600 hover:text-blue-800"
											>
												{truncateTxId(tx.txId)}
											</a>
											{#if tx.childTx}
												<span
													class="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
													title="Has child transaction: {tx.childTx}"
												>
													Child
												</span>
											{/if}
										</div>
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{tx.productionBatchId || '-'}
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{tx.typeOfRoast || '-'}
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{tx.locationOfRoastingPlant || '-'}
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{formatKgAmount(tx.kgCoffeeRoasted)}
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{tx.roastDate || '-'}
									</td>
									<td class="px-6 py-4 text-sm text-gray-900">
										<div class="text-xs">
											{formatHarvestPeriod(
												tx.zone1HarvestBegin,
												tx.zone1HarvestEnd,
												tx.zone2HarvestBegin,
												tx.zone2HarvestEnd
											)}
										</div>
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
										<div class="flex flex-col gap-1">
											{#if tx.zone1CoffeeSpecies}
												<span class="text-xs">Z1: {tx.zone1CoffeeSpecies}</span>
											{/if}
											{#if tx.zone2CoffeeSpecies}
												<span class="text-xs">Z2: {tx.zone2CoffeeSpecies}</span>
											{/if}
											{#if !tx.zone1CoffeeSpecies && !tx.zone2CoffeeSpecies}
												<span>-</span>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="mt-4 text-sm text-gray-600">
			Showing {data.transactions.length} transaction{data.transactions.length !== 1 ? 's' : ''}
		</div>
	{/if}
</div>
