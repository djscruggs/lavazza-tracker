<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import github from '$lib/assets/github.png';

	let { children } = $props();

	let syncing = $state(false);
	let syncMessage = $state('');

	async function triggerSync() {
		syncing = true;
		syncMessage = '';
		try {
			const response = await fetch('/api/sync', { method: 'POST' });
			const result = await response.json();
			if (result.success) {
				syncMessage = `Sync complete! Processed ${result.transactionsProcessed} transaction(s)`;
				// Refresh the page after a short delay
				setTimeout(() => window.location.reload(), 1500);
			} else {
				syncMessage = `Sync failed: ${result.error}`;
			}
		} catch (error) {
			syncMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			syncing = false;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Lavazza Tracker</title>
</svelte:head>

<div class="min-h-screen bg-gray-100">
	<header class="bg-white shadow-sm">
		<div class="container mx-auto px-4 py-4">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-xl font-bold text-gray-900">Lavazza Tracker</h1>
					<p class="text-sm text-gray-600">Algorand Blockchain Monitor</p>
				</div>
				<div class="flex items-center gap-4">
					{#if syncMessage}
						<div
							class="rounded px-3 py-1 text-sm {syncMessage.includes('failed') ||
							syncMessage.includes('Error')
								? 'bg-red-100 text-red-800'
								: 'bg-green-100 text-green-800'}"
						>
							{syncMessage}
						</div>
					{/if}
					<button
						onclick={triggerSync}
						disabled={syncing}
						class="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{syncing ? 'Syncing...' : 'Sync Now'}
					</button>
				</div>
			</div>
		</div>
	</header>

	<main>
		{@render children()}
	</main>

	<footer class="mt-12 border-t border-gray-200 py-6">
		<div class="container mx-auto px-4 text-center text-sm text-gray-600">
			<p class="mb-2">
				<strong>This site is in no way affiliated with Lavazza Coffee.</strong>
			</p>
			<p>
				It just displays their known transactions on
				<a
					href="https://explorer.perawallet.app/transactions/?transaction_list_address=IHUIX3OSTQO7DQ77SOQ66IR6WVQ5PAFGTBF4TBEC36IUSLGU7O3KD6TJ4E"
					target="_blank"
					rel="noopener noreferrer"
					class="text-blue-600 hover:text-blue-800">Algorand</a
				>
			</p>
			<div class="mt-4">
				<a
					href="https://github.com/djscruggs/lavazza-tracker"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-block transition-opacity hover:opacity-70"
				>
					<img src={github} alt="GitHub" class="h-8 w-8" />
				</a>
			</div>
		</div>
	</footer>
</div>
