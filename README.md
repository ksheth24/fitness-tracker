# Quick Workout Logger PWA

Mobile-first React PWA for fast weightlifting workout logging, backed by Express and PostgreSQL.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Update `DATABASE_URL` and `JWT_SECRET`.
4. Run `npm run db:migrate`.
5. Start the app with `npm run dev`.

The React app runs at `http://localhost:5173` and proxies API requests to `http://localhost:3001`.

## Deployment

The frontend is deployed on Vercel, the Express API on AWS App Runner, and PostgreSQL on Supabase.

### Supabase

From the Supabase project's **Connect** dialog, copy the **Session pooler** connection string (port `5432`). Use it as `DATABASE_URL`, including `sslmode=require`, and initialize the database once:

```bash
npm run db:migrate
```

### AWS App Runner API

Create a source-code service from this repository and select **Use a configuration file**. The included `apprunner.yaml` installs dependencies, starts the API, and exposes port `3001`.

Configure these runtime environment variables or secrets:

```text
DATABASE_URL=<Supabase session-pooler URL>
JWT_SECRET=<long random secret>
FRONTEND_URL=https://your-project.vercel.app
APP_URL=https://your-project.vercel.app
```

Use `/api/health` as the App Runner HTTP health-check path. A VPC connector is not required for Supabase.

### Vercel frontend

Set this Vercel build-time environment variable, replacing the hostname with the App Runner service URL:

```text
VITE_API_URL=https://your-service.region.awsapprunner.com/api
```

Redeploy the frontend after changing `VITE_API_URL`. If it has multiple permanent domains, provide them as a comma-separated `FRONTEND_URL` value. Preview domains can use a single-label wildcard such as `https://*.your-team.vercel.app`. When `FRONTEND_URL` is omitted, the API accepts the origin configured in `APP_URL`.

## Features

- Email/password accounts with user-scoped workout data
- Active logging with favorite and recent exercises
- Exercise library and session history
- Progress charts, PR display, and workout frequency heatmap
- Installable PWA
