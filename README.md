# Lavazza Tracker

Track and report on Lavazza coffee activity via their transactions on the Algorand blockchain.

## Technology Stack

- **Frontend**: SvelteKit
- **Database**: SQLite/libSQL with Drizzle ORM
- **Blockchain**: Algorand (via AlgoNode free API)
- **Hosting**: Netlify
- **Production DB**: Turso (libSQL cloud database)

## Features

- Hourly sync of Algorand blockchain transactions for Lavazza address
- Parse and store roasting data from transaction notes
- Track production batches, roast dates, coffee species, and harvest information

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Edit .env and add your DATABASE_URL
# For local development, you can use:
# DATABASE_URL=file:./local.db

# For production with Turso:
# DATABASE_URL=libsql://your-database.turso.io
# DATABASE_AUTH_TOKEN=your-auth-token
```

### Database Setup

```bash
# Generate database migrations
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Drizzle Studio to view database
npm run db:studio
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:5173
```

### Local Development with Netlify

```bash
# Run with Netlify dev for production-like environment
netlify dev
```

## Algorand Sync

The application automatically syncs transactions from the Algorand blockchain for the wallet addresses found in 
`/drizzle/src/lib/server/algorand.ts`

### Manual Sync

To manually trigger a sync:

```bash
# Using curl
curl -X POST http://localhost:5173/api/sync

# Check sync status
curl http://localhost:5173/api/sync
```

### Historical Sync (One-Time Backfill)

To fetch ALL historical transactions from the beginning, run the historical sync script:

```bash
# Using the CLI script (recommended)
npm run sync:historical
```

This will:
- Fetch all historical transactions using pagination
- Process them in batches of 100 transactions
- Add a 100ms delay between batches to respect API rate limits
- Parse and store all roasting data
- Update the sync status when complete

**Alternative: API Endpoint**

You can also trigger historical sync via API (note: this may timeout for large datasets):

```bash
curl -X POST http://localhost:5173/api/sync/historical
```

**Important Notes:**
- Run this **once** after initial setup to backfill historical data
- After historical sync completes, use the regular hourly sync for new transactions
- The process can take several minutes depending on transaction count
- You can safely stop and restart the script - it will skip already-processed transactions

### Setting Up Hourly Cron Job

#### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/sync.yml`:

```yaml
name: Hourly Algorand Sync

on:
  schedule:
    - cron: '0 * * * *' # Every hour
  workflow_dispatch: # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/sync
```

#### Option 2: External Cron Service

Use services like:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [Uptime Robot](https://uptimerobot.com) (with monitor)

Configure them to make a POST request to `https://your-domain.com/api/sync` every hour.

#### Option 3: Local Cron (for self-hosted)

Add to your crontab:

```bash
0 * * * * curl -X POST http://localhost:5173/api/sync
```

## Data Structure

### Transaction Notes Format

Example transaction note from Lavazza:

```
PARENT COMPANY ID: 116174 ROASTING Production_Batch_ID: GH24I01 Type of roast: Drum Roast
Location of roasting plant: IT - Casa 1895 Kg of coffee roasted: 7.200,00 Kg Roast date: 24/09/2025
ZONE 1 Coffee Species: ARABICA Harvest begin: 01/08/2024 Harvest end: 31/12/2024
ZONE 2 Coffee Species: ARABICA Harvest begin: 01/08/2024 Harvest end: 31/12/2024
Child_TX -> "STQMISFOM3MXRIFQXLSVP2DETW67NKZSGNLGSLN67DGD3GFKBOAA"
```

### Database Schema

- **sync_status**: Tracks last processed blockchain round
- **algorand_transaction**: Stores raw transaction data
- **roasting_data**: Parsed roasting information from transaction notes

## API Endpoints

### POST /api/sync
Triggers manual sync of Algorand transactions.

**Response:**
```json
{
  "success": true,
  "transactionsProcessed": 5,
  "timestamp": "2025-01-10T12:00:00.000Z"
}
```

### GET /api/sync
Returns current sync status.

**Response:**
```json
{
  "address": "IHUIX3OSTQO7DQ77SOQ66IR6WVQ5PAFGTBF4TBEC36IUSLGU7O3KD6TJ4E",
  "lastSync": {
    "lastProcessedRound": 12345678,
    "lastSyncedAt": "2025-01-10T12:00:00.000Z"
  },
  "serverTime": "2025-01-10T12:30:00.000Z"
}
```

### POST /api/sync/historical
Triggers full historical sync of all transactions (one-time backfill).

**Request Body (optional):**
```json
{
  "batchSize": 100,
  "delayBetweenBatches": 100
}
```

**Response:**
```json
{
  "success": true,
  "totalTransactions": 150,
  "pagesProcessed": 2,
  "timestamp": "2025-01-10T12:00:00.000Z"
}
```

## Security Considerations

### Securing the Sync Endpoint

To prevent unauthorized access to the sync endpoint, add authentication:

1. Add `SYNC_SECRET` to your environment variables
2. Uncomment authentication code in `/src/routes/api/sync/+server.ts`
3. Include the secret in cron requests:

```bash
curl -X POST https://your-domain.com/api/sync \
  -H "Authorization: Bearer your-secret-token"
```

## Deployment

### Netlify Deployment

This project is configured for Netlify deployment with the following setup:

1. **Create a Turso Database** (for production):
   ```bash
   # Install Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash

   # Create a database
   turso db create lavazza-tracker

   # Get the database URL
   turso db show lavazza-tracker --url

   # Create an auth token
   turso db tokens create lavazza-tracker
   ```

2. **Push Database Schema to Turso**:
   ```bash
   DATABASE_URL="libsql://your-db.turso.io" DATABASE_AUTH_TOKEN="your-token" npm run db:push
   ```

3. **Configure Netlify Environment Variables**:
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Add the following variables:
     - `DATABASE_URL`: Your Turso database URL (e.g., `libsql://your-db.turso.io`)
     - `DATABASE_AUTH_TOKEN`: Your Turso authentication token

4. **Deploy**:
   ```bash
   # Connect your repository to Netlify via the dashboard, or use CLI:
   netlify deploy --prod
   ```

### Important Files for Deployment

- `netlify.toml`: Build configuration
- `_redirects`: HTTP to HTTPS redirect rules (required by SvelteKit adapter)
- `svelte.config.js`: Uses `@sveltejs/adapter-netlify`

### Viewing Production Logs

View function logs in the Netlify Dashboard:
1. Go to your site dashboard
2. Click **Functions** tab
3. Click **sveltekit-render** function
4. View logs to debug any issues

## Development Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run check            # Type check
npm run lint             # Lint code
npm run format           # Format code with Prettier
npm run db:push          # Push database schema
npm run db:generate      # Generate migrations
npm run db:studio        # Open Drizzle Studio
npm run sync:historical  # Fetch all historical transactions (one-time)
```

## Troubleshooting

### 500 Error in Production
- Check Netlify function logs for detailed error messages
- Verify `DATABASE_URL` and `DATABASE_AUTH_TOKEN` are set in Netlify environment variables
- Ensure database schema has been pushed to production database with `npm run db:push`

### Build Errors
- If you see redirect errors, ensure `_redirects` file is in the project root
- The project uses `@sveltejs/adapter-netlify` explicitly (not `adapter-auto`)

## License

MIT
