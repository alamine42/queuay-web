# Queuay Web

AI-powered QA testing SaaS platform.

## Tech Stack

- **Next.js 14+** - App Router
- **Supabase** - Auth, PostgreSQL, Realtime, Storage
- **shadcn/ui + Tailwind CSS** - UI components
- **BullMQ + Redis** - Background job queue
- **Playwright** - Test execution in workers
- **Claude API** - AI features

## Getting Started

### Prerequisites

- Node.js 18+
- Redis server (local or hosted)
- Supabase project

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

3. Configure your `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   REDIS_URL=redis://localhost:6379
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

4. Run database migrations in Supabase SQL editor:
   ```bash
   cat supabase/migrations/001_initial_schema.sql
   ```

5. Create the screenshots storage bucket in Supabase:
   ```sql
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('screenshots', 'screenshots', true);
   ```

### Development

Run the Next.js app:
```bash
npm run dev
```

Run the worker (in a separate terminal):
```bash
npm run worker
```

## Project Structure

```
queuay-web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth pages
│   │   ├── (dashboard)/        # Dashboard pages
│   │   ├── actions/            # Server actions
│   │   └── api/v1/             # API routes
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── dashboard/          # Dashboard components
│   │   ├── story/              # Story components
│   │   ├── test-run/           # Test run components
│   │   └── schedule/           # Schedule components
│   └── lib/
│       ├── supabase/           # Supabase clients
│       ├── queue/              # BullMQ setup
│       ├── ai/                 # AI modules
│       └── hooks/              # React hooks
├── worker/                     # Background worker
│   ├── index.ts                # Worker entry point
│   ├── test-executor.ts        # Test execution
│   ├── execute-story.ts        # Story runner
│   └── scheduler.ts            # Cron scheduler
└── supabase/
    └── migrations/             # Database migrations
```

## API

### Trigger Test Run

```bash
curl -X POST https://your-app.vercel.app/api/v1/runs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app-uuid",
    "environmentId": "env-uuid",
    "journeyIds": ["journey-uuid"]
  }'
```

### Get Test Run Status

```bash
curl https://your-app.vercel.app/api/v1/runs?id=run-uuid \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Deployment

### Vercel (Next.js)

1. Connect your repo to Vercel
2. Add environment variables
3. Deploy

### Railway/Render (Worker)

1. Create a new service
2. Set the start command: `npm run worker`
3. Add environment variables
4. Deploy

## License

MIT
