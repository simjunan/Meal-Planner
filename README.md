# 🍜 MealMate

> AI-assisted meal planning for households — browse Chinese-focused recipes, plan your week, and let your helper know what to cook.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/simjunan/Meal-Planner)

---

## Overview

MealMate is a **mobile-first web application** that eliminates the daily friction of meal planning between employers and domestic helpers. Employers browse a curated library of crowd-validated Chinese-focused recipes, receive AI-powered two-day-ahead suggestions, and assign meals to a weekly calendar. Helpers open the same account each morning to see exactly what to prepare and follow recipe links — no more daily guesswork.

Built entirely on **free-tier infrastructure**: Supabase (database + auth), Vercel (hosting), and Groq (AI). Ongoing production cost: **$0/month**.

---

## Features

| Feature | Description |
|---|---|
| **Shared Account** | One household login — employer and helper use the same account |
| **Recipe Library** | Browse crowd-validated Chinese-focused recipes (≥500 ratings) |
| **Full-Text Search** | Search by name, ingredient, or cuisine with 300ms debounce |
| **Smart Filters** | Filter by cuisine, cook time, and dietary tags |
| **AI Suggestions** | Two-day-ahead meal recommendations powered by Groq (Llama 3.1) |
| **Weekly Calendar** | Assign recipes to breakfast, lunch, and dinner slots |
| **Bookmarks** | Save favourite recipes with one tap |
| **Mobile-First UI** | Designed for phones; enhanced for tablet and desktop |
| **Undo Remove** | 5-second undo when removing meals from the calendar |
| **Offline-Friendly** | Optimistic UI updates throughout |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Next.js API Routes (Vercel Serverless Functions) |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (JWT, httpOnly cookies) |
| Full-text Search | PostgreSQL `tsvector` via Supabase |
| AI | Groq API — `llama-3.1-8b-instant` |
| Hosting | Vercel (Hobby tier) |
| CI / Crawler | GitHub Actions |

---

## Project Structure

```
mealmate/
├── app/
│   ├── (auth)/                  # Public auth pages
│   │   ├── login/
│   │   ├── register/
│   │   ├── reset-password/
│   │   └── update-password/
│   ├── (app)/                   # Protected app pages
│   │   ├── layout.tsx           # App shell with bottom nav
│   │   ├── dashboard/           # Home + AI recommendations
│   │   ├── recipes/             # Recipe library + search
│   │   ├── calendar/            # Weekly meal calendar
│   │   └── bookmarks/           # Saved recipes
│   └── api/
│       ├── auth/callback/       # Supabase OAuth callback
│       ├── recommendations/     # POST — Groq AI suggestions
│       ├── recipes/             # GET — recipe search
│       ├── meal-plans/          # GET / POST / DELETE
│       └── bookmarks/           # POST (toggle) + GET list/full
├── components/
│   ├── layout/                  # AppHeader, BottomNav
│   ├── recipes/                 # RecipeCard, RecipeDetailPanel, SaveToPlanModal
│   └── ui/                      # Toast, StarRating, SkeletonCard
├── lib/
│   ├── supabase/                # client.ts, server.ts, middleware.ts
│   └── utils.ts
├── middleware.ts                 # Auth redirect guard
├── supabase/
│   └── schema.sql               # Full database schema + RLS policies
└── types/index.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)
- A [Groq](https://console.groq.com) API key (free tier)

### 1. Clone and install

```bash
git clone https://github.com/simjunan/Meal-Planner.git
cd Meal-Planner
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Supabase — from https://app.supabase.com/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only — NEVER expose to client
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Groq — from https://console.groq.com/keys
GROQ_API_KEY=your-groq-api-key
```

### 3. Set up the database

1. Open your [Supabase SQL Editor](https://app.supabase.com/project/_/sql)
2. Copy the contents of `supabase/schema.sql`
3. Paste and run it

This creates all tables, RLS policies, indexes, the FTS trigger, and the `get_email_by_user_id` helper function.

### 4. Configure Supabase Auth

In your Supabase Dashboard:

1. **Authentication > URL Configuration**
   - Site URL: `http://localhost:3000` (development) or your Vercel URL (production)
   - Redirect URLs: add `http://localhost:3000/api/auth/callback` and `https://your-app.vercel.app/api/auth/callback`

2. **Authentication > Email** — enable email confirmations if desired (or disable for easier dev)

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

### One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/simjunan/Meal-Planner)

### Manual deploy

1. Push this repository to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Set environment variables in **Vercel Dashboard > Project > Settings > Environment Variables**:

   | Variable | Scope |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | All environments |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All environments |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — do NOT expose to client |
   | `GROQ_API_KEY` | **Server only** — do NOT expose to client |

4. Deploy!

### Vercel Hobby-tier constraints

| Constraint | Impact | Mitigation in this app |
|---|---|---|
| 10s serverless function timeout | Groq must respond in time | `llama-3.1-8b-instant` is very fast; `maxDuration = 10` set on the route |
| No persistent filesystem | Can't write temp files | All data goes directly to Supabase |
| No formal uptime SLA | Acceptable for personal use | N/A |

---

## Populating the Recipe Library

The recipe library is populated by a crawler (run via GitHub Actions). To get started:

**Option A — Seed manually**
Uncomment and adapt the INSERT statements at the bottom of `supabase/schema.sql` and run them in the SQL editor.

**Option B — Build the crawler**
Create a `scripts/crawler.js` file that:
1. Scrapes Chinese cookbook sources (AllRecipes, Taste of Asian Food, China Sichuan Food, etc.)
2. Filters for recipes with ≥500 ratings
3. Upserts into Supabase using the service role key (never exposed to client)

Add a GitHub Actions workflow (`.github/workflows/crawl.yml`) to run it nightly:

```yaml
name: Recipe Crawler
on:
  schedule:
    - cron: '0 2 * * *'   # 2:00 AM UTC nightly
  workflow_dispatch:
jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: node scripts/crawler.js
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

> **Important:** The crawler must write directly to Supabase — no local file writes. Vercel serverless functions have no persistent filesystem, and GitHub Actions runners are ephemeral.

---

## Key Design Decisions

### Username-based login
Supabase Auth natively uses email. MealMate stores a `username` in the `profiles` table and resolves it to an email via the `get_email_by_user_id` SQL function (SECURITY DEFINER) before calling `signInWithPassword`. This keeps the user-facing login email-free while remaining compatible with Supabase Auth.

### AI recommendation caching
Groq completions are cached in `ai_recommendation_cache` per user per calendar day. On a cache hit the Groq API is not called — staying well within the free tier.

### Optimistic UI
All bookmark toggles and calendar updates apply immediately in the UI and sync to Supabase in the background. Failures revert the optimistic state and show a toast error.

### Row Level Security
All user tables enforce `(user_id = auth.uid())`. The `recipes` table is readable by all authenticated users and only writable by the service role (crawler).

---

## Environment Variable Reference

| Variable | Client-safe? | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | ✅ | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **Never** | Crawler only | Full DB access — server/CI only |
| `GROQ_API_KEY` | ❌ **Never** | ✅ | Groq API key for AI suggestions |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes
4. Push and open a pull request

---

## Roadmap

- [ ] Grocery shopping list generation from weekly plan
- [ ] Separate employer / helper permission levels
- [ ] Chinese-language UI
- [ ] Xiachufang.com recipe integration (Phase 2)
- [ ] Push notifications for meal plan reminders
- [ ] Social sharing of meal plans

---

## License

MIT © 2026 MealMate
