# PS Consult – UNTH: Deployment Guide

## Architecture: Vercel + Supabase

```
┌─────────────────────────────────────────────┐
│                  VERCEL                      │
│                                              │
│  ┌──────────────┐   ┌────────────────────┐  │
│  │  React SPA   │   │  FastAPI (Python)   │  │
│  │  (Static)    │   │  /api/* serverless  │  │
│  │  frontend/   │   │  api/index.py       │  │
│  └──────────────┘   └────────┬───────────┘  │
│                              │               │
└──────────────────────────────┼───────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   SUPABASE          │
                    │   PostgreSQL DB     │
                    └─────────────────────┘
```

---

## Step 1: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project credentials:
   - Go to **Settings → Database → Connection string**
   - Copy the **URI** connection string (looks like):
     ```
     postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```
3. The app will auto-create all tables on first startup

---

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Push your code to a GitHub/GitLab repository
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your repository
4. Vercel will auto-detect the `vercel.json` configuration
5. Add these **Environment Variables** in the Vercel dashboard:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres` |
   | `SECRET_KEY` | A strong random string (32+ chars) |
   | `ALGORITHM` | `HS256` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` |
   | `PYTHONPATH` | `backend` |

6. Click **Deploy**

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy from project root
cd "PLASTIC CONSULTS"
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add SECRET_KEY
vercel env add PYTHONPATH   # value: backend

# Deploy to production
vercel --prod
```

---

## Step 3: Seed the Database

After deployment, seed the database with initial users and schedule data.

### Option A: Run seed script locally (pointing at Supabase)

```bash
cd backend

# Create a .env file with your Supabase URL
echo "DATABASE_URL=postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres" > .env

# Activate venv and run seed
.\venv\Scripts\activate   # Windows
# source venv/bin/activate  # Mac/Linux

python seed.py
```

### Option B: Use Supabase SQL Editor

You can also run SQL directly in the Supabase Dashboard → SQL Editor to insert initial data.

---

## Step 4: Verify Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Check API health: `https://your-app.vercel.app/api/health`
3. Check API docs: `https://your-app.vercel.app/api/docs`
4. Login with: **admin** / **admin123**

---

## Project Structure

```
PLASTIC CONSULTS/
├── api/
│   └── index.py              # Vercel serverless entry point
├── backend/
│   ├── routers/               # API route handlers
│   │   ├── auth_router.py
│   │   ├── consults_router.py
│   │   ├── reviews_router.py
│   │   ├── dashboard_router.py
│   │   └── schedule_router.py
│   ├── main.py                # FastAPI app
│   ├── models.py              # SQLAlchemy models
│   ├── schemas.py             # Pydantic schemas
│   ├── auth.py                # JWT auth & RBAC
│   ├── config.py              # App configuration
│   ├── database.py            # DB connection
│   ├── seed.py                # Database seeder
│   └── requirements.txt       # Backend deps
├── frontend/
│   ├── src/                   # React source
│   ├── public/                # Static assets + PWA
│   ├── package.json
│   └── vite.config.js
├── vercel.json                # Vercel deployment config
├── requirements.txt           # Root deps (for Vercel Python runtime)
└── .env.example               # Environment template
```

---

## Local Development

```bash
# Backend
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
pip install -r requirements.txt
python seed.py                 # First time only
python -m uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                    # → http://localhost:3000
```

The frontend dev server proxies `/api/*` to `http://localhost:8000` automatically.

---

## Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Registrar | `ps_registrar` | `registrar123` |
| Sr Registrar | `ps_senior_reg` | `senreg123` |
| Consultant | `ps_consultant` | `consultant123` |
| Orthopaedic Unit | `ortho_unit` | `ortho123` |
| General Surgery | `gen_surgery` | `gensurg123` |
| Paediatrics | `paediatrics` | `paeds123` |
| Emergency | `emergency` | `emergency123` |

> ⚠️ **CHANGE ALL PASSWORDS IN PRODUCTION!**

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Supabase PostgreSQL connection URI |
| `SECRET_KEY` | Yes | — | JWT signing secret (use a strong random string) |
| `ALGORITHM` | No | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `480` | Token TTL (8 hours) |
| `CORS_ORIGINS` | No | `localhost` | Comma-separated allowed origins |
| `PYTHONPATH` | Yes (Vercel) | — | Set to `backend` for Vercel |
