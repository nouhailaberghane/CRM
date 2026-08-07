# Kenza trichologist center

CRM capillaires pour conseillères, parapharmacie et administrateurs — avec parcours diagnostic cliente.

## Features

- **3 accès :** Admin, Conseillère, Parapharmacie
- **Enregistrement cliente** avec identifiant automatique
- **Diagnostic d’hydratation** (caméra ou galerie) — photo non stockée, une seule fois par cliente
- **Commandes parapharmacie** et tableau de bord admin
- **Exports**, journal d’audit, mode sombre

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js, TypeScript, TailwindCSS, React Hook Form, TanStack Query, Recharts |
| Backend | FastAPI, SQLAlchemy, JWT, Pydantic |
| Database | PostgreSQL (SQLite en local) |

## Quick start (local)

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

### Comptes (configuration initiale)

| Accès | Identifiant | Mot de passe |
|-------|-------------|--------------|
| Conseillère | `conseillere` | `cccc1234@` |
| Admin | `admin@haircare.com` | `Admin123!` |
| Parapharmacie | `pharmacy@haircare.com` | `Pharma123!` |

Ces identifiants ne sont pas affichés dans l’interface. Aucune cliente fictive n’est créée au démarrage.

## Docker

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Postgres: `localhost:5432`

## Diagnostic privacy

1. Customer opens `/diagnostic` and enters their Customer ID
2. Camera opens; one photo is captured
3. Image is uploaded, validated in memory, then discarded
4. Humidity is a **random realistic value between 40% and 60%**
5. Only `customer_id`, humidity, and timestamp are stored — **no images**

## Deployment

Checklist complète (variables + commandes + tests) :

→ **[DEPLOY.md](./DEPLOY.md)** — Vercel (frontend) + Railway/Render (backend + Postgres)

### Rappel rapide

| Couche | Plateforme | Root / note |
|--------|------------|-------------|
| Frontend | Vercel | dossier `frontend` · `NEXT_PUBLIC_API_URL=https://API/api` |
| Backend | Railway ou Render | dossier `backend` · Dockerfile inclus |
| DB | Postgres managé | `DATABASE_URL` (auto-conversion `postgres://` → `postgresql+asyncpg://`) |

Variables backend critiques : `APP_ENV=production`, `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `FRONTEND_URL`.

### Automatic backups

Use `backend/scripts/backup.sh` on a cron schedule:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/haircare ./backend/scripts/backup.sh
```

## API overview

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Customers | CRUD, export, autocomplete, assign program, recommend product |
| Advisors | Admin management |
| Products / Programs | Catalog management |
| Orders | List + JSON import |
| Diagnostic | Public lookup + analyze |
| Dashboard | KPIs, charts data, PDF export |
| Audit | Admin audit trail |

Full interactive docs: `/docs` (Swagger) and `/redoc`.

## Project structure

```
appara/
├── backend/               # FastAPI API
│   ├── app/
│   │   ├── api/           # Route modules
│   │   ├── core/          # Security & dependencies
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Business logic
│   ├── scripts/           # schema.sql + backup.sh
│   └── Dockerfile
├── frontend/              # Next.js app
│   └── src/app/           # App router pages
├── docker-compose.yml
└── README.md
```

## Security

- JWT authentication + role-based access control
- Bcrypt password hashing
- Advisor data isolation (advisors only see their customers)
- Input validation via Pydantic
- CORS restricted to configured origins
- No customer hair images persisted
