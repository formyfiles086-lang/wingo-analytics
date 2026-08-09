# WinGo Analytics Platform 📱📊

A standalone, mobile-first analytics and pattern detection platform for WinGo (30-second variant). Calculates probabilities for BIG/SMALL, Color (Red/Green/Violet), and Numbers (0-9) based on historical draw patterns.

> ⚠️ **Disclaimer**: Statistical pattern analysis only. Draws are independent random events. Predictions are probabilistic and never guaranteed. Does NOT place bets or manage funds.

---

## Technical Stack

- **Frontend**: React 18, TypeScript, Vite, PWA (Progressive Web App), Recharts
- **Backend**: Node.js, Express, TypeScript, Server-Sent Events (SSE), Winston Logger
- **Database**: Supabase (PostgreSQL)
- **Data Source**: Public live stream endpoint (`draw.ar-lottery01.com`)

---

## Running Locally

### Prerequisites
- Node.js 18+ installed

### 1. Start Backend Server
```bash
cd wingo-analytics/backend
npm install
npm run dev
```
Backend API will run on `http://localhost:3001`.

### 2. Start Mobile Frontend
```bash
cd wingo-analytics/frontend
npm install
npm run dev
```
Frontend PWA will run on `http://localhost:5173`.

---

## Free Cloud Deployment (24/7 Mobile Access - PC Off)

### 1. Deploy Database (Supabase)
1. Sign up free at [supabase.com](https://supabase.com).
2. Create project `wingo-analytics`.
3. Open **SQL Editor** -> Paste `docs/schema.sql` -> Run query.

### 2. Deploy Backend API (Railway / Render)
1. Go to [railway.app](https://railway.app) or [render.com](https://render.com).
2. Connect your GitHub repository.
3. Set root directory to `wingo-analytics/backend`.
4. Set Environment Variables:
   - `PORT=3001`
   - `SUPABASE_URL=https://oftbovizsyskhjakrbebv.supabase.co`
   - `SUPABASE_ANON_KEY=<your_anon_key>`
5. Deploy! Copy your live API URL (e.g. `https://wingo-api.up.railway.app`).

### 3. Deploy Mobile PWA Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com).
2. Import project -> Set root directory to `wingo-analytics/frontend`.
3. Set Environment Variable:
   - `VITE_API_URL=https://wingo-api.up.railway.app`
4. Deploy!
5. Open the Vercel URL on your mobile phone browser (Chrome/Safari) -> Tap **"Add to Home Screen"** to install as a standalone mobile app!

---

## API Endpoints

- `GET /api/status` - System health, source status, total results
- `GET /api/prediction/latest` - Current round mathematical probabilities
- `GET /api/results/latest?limit=20` - Recent results feed
- `GET /api/results/history?page=1&pageSize=50` - Paginated history
- `GET /api/patterns` - Transition matrix, streaks, overdue numbers
- `GET /api/statistics` - Rolling window frequency tables & charts
- `GET /api/events` - Real-time SSE stream
