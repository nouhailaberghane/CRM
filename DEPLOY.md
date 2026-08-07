# Checklist déploiement — Kenza trichologist center

**Stack cible :** Frontend → **Vercel** · Backend + Postgres → **Railway** *ou* **Render**

Ordre recommandé : **1) Postgres → 2) Backend → 3) Frontend → 4) CORS → 5) Tests**

---

## Prérequis

- [ ] Compte [GitHub](https://github.com) avec le repo poussé
- [ ] Compte [Vercel](https://vercel.com)
- [ ] Compte [Railway](https://railway.app) **ou** [Render](https://render.com)
- [ ] Générer un `SECRET_KEY` (à coller plus tard) :

```bash
# PowerShell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# ou OpenSSL / Git Bash
openssl rand -hex 32
```

- [ ] Choisir des **mots de passe admin / pharma / conseillère** différents de ceux du README

---

## A. Base de données Postgres

### Option Railway

1. New Project → **Add PostgreSQL**
2. Onglet Variables / Connect → copier l’URL `DATABASE_URL`  
   (souvent `postgresql://…` — l’API la convertit automatiquement en `postgresql+asyncpg://`)
3. Noter l’URL pour le service backend

### Option Render

1. Dashboard → **New +** → **PostgreSQL**
2. Créer la base → copier **Internal Database URL** (si backend sur Render)  
   ou **External Database URL** (si backend ailleurs)
3. Noter l’URL

Checklist DB :

- [ ] Postgres créé
- [ ] `DATABASE_URL` sauvegardée (ne pas la committer)
- [ ] Plan avec backup activé si possible

---

## B. Backend FastAPI (Railway ou Render)

Dossier racine du service : **`backend/`**  
Dockerfile : `backend/Dockerfile`  
Start command (si besoin manuel) :

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

> Sur Railway/Render, si le port est injecté via `$PORT`, adapte le CMD.  
> Le Dockerfile actuel écoute sur **8000** — sur Railway, configure le port public **8000** ou override la commande start avec `$PORT`.

### Variables d’environnement backend (toutes obligatoires en prod)

| Variable | Exemple / valeur | Notes |
|----------|------------------|--------|
| `APP_NAME` | `Kenza trichologist center` | Affiché dans `/health` |
| `APP_ENV` | `production` | |
| `SECRET_KEY` | *(secret long généré)* | **Jamais** la valeur par défaut |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/xxx` | Fournie par Postgres |
| `CORS_ORIGINS` | `https://ton-app.vercel.app` | URL Vercel exacte (sans slash final) |
| `FRONTEND_URL` | `https://ton-app.vercel.app` | Idem |
| `DEFAULT_ADMIN_EMAIL` | `admin@ton-domaine.com` | Compte créé au 1er démarrage |
| `DEFAULT_ADMIN_PASSWORD` | *(mot de passe fort)* | À changer après 1ère connexion |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | 12 h (optionnel) |
| `PHARMACY_BASE_URL` | `https://pharmacy.example.com` | Optionnel |

> **Important :** au premier déploiement, mets `CORS_ORIGINS` / `FRONTEND_URL` en temporaire si tu n’as pas encore l’URL Vercel, puis **mets à jour** dès que Vercel est live (sinon le navigateur bloquera les appels API).

### Railway — étapes

1. New Project → **GitHub Repo**
2. Root Directory : `backend`
3. Build : Dockerfile (détecté) ou Nixpacks + `pip install -r requirements.txt`
4. Coller toutes les variables ci-dessus
5. Générer un domaine public (ex. `https://kenza-api.up.railway.app`)
6. Vérifier :

```bash
curl https://TON-BACKEND.up.railway.app/health
# → {"status":"ok","app":"Kenza trichologist center"}
```

```bash
curl https://TON-BACKEND.up.railway.app/docs
# → page Swagger
```

### Render — étapes

1. **New Web Service** → repo GitHub
2. Root Directory : `backend`
3. Runtime : **Docker** (ou Python 3.12)
4. Si Python sans Docker :
   - Build : `pip install -r requirements.txt`
   - Start : `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Coller les variables d’environnement
6. Health check path : `/health`
7. Noter l’URL (ex. `https://kenza-api.onrender.com`)

Checklist backend :

- [ ] Service up (vert)
- [ ] `/health` OK
- [ ] `/docs` accessible
- [ ] Postgres lié (`DATABASE_URL`)
- [ ] `SECRET_KEY` prod
- [ ] Admin seed créé (login test plus bas)

---

## C. Frontend Next.js (Vercel)

1. Vercel → **Add New Project** → importer le repo
2. **Root Directory** : `frontend`
3. Framework : Next.js (auto)
4. Build Command : `npm run build` (défaut)
5. Output : défaut Next.js

### Variables d’environnement frontend (Vercel)

| Variable | Exemple | Notes |
|----------|---------|--------|
| `NEXT_PUBLIC_API_URL` | `https://TON-BACKEND.up.railway.app/api` | **Doit** finir par `/api` |
| `NEXT_PUBLIC_BACKEND_URL` | `https://TON-BACKEND.up.railway.app` | Optionnel — utilisé pour le rewrite `/api/*` serveur |
| `NEXT_PUBLIC_APP_NAME` | `Kenza trichologist center` | Optionnel |

> Le client Axios utilise `NEXT_PUBLIC_API_URL` (voir `frontend/src/lib/api.ts`).  
> Sans cette variable, le front appelle `/api` (proxy local) qui **ne marchera pas** en prod Vercel vers Railway sauf si tu configures aussi le rewrite avec `NEXT_PUBLIC_BACKEND_URL`.

**Recommandation simple :** définir uniquement :

```env
NEXT_PUBLIC_API_URL=https://TON-BACKEND.up.railway.app/api
```

6. Deploy → noter l’URL (ex. `https://kenza-trichologist.vercel.app`)

Checklist frontend :

- [ ] Build Vercel réussi
- [ ] Site accessible en HTTPS
- [ ] Page login s’affiche avec le nom **Kenza trichologist center**

---

## D. Brancher CORS (retour backend)

Dès que l’URL Vercel est connue, mettre à jour le backend :

```env
CORS_ORIGINS=https://kenza-trichologist.vercel.app
FRONTEND_URL=https://kenza-trichologist.vercel.app
```

- [ ] Redémarrer / redeploy le backend après changement
- [ ] Pas de slash final (`…vercel.app/` ❌)
- [ ] Si tu as un domaine custom Vercel, ajoute-le aussi (séparé par des virgules) :

```env
CORS_ORIGINS=https://kenza-trichologist.vercel.app,https://www.ton-domaine.com
```

---

## E. Tests de validation post-déploiement

### 1. Santé API

```bash
curl https://TON-BACKEND/health
curl https://TON-BACKEND/api/auth/me
# → 401 sans token = normal
```

### 2. Login admin (depuis le navigateur)

1. Ouvrir `https://TON-VERCEL/login?access=admin`
2. Email / mot de passe = `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`
3. [ ] Accès dashboard OK

### 3. Autres rôles

| Accès | URL | Identifiant (si seed inchangé) |
|-------|-----|--------------------------------|
| Conseillère | `/login?access=advisor` | `conseillere` / (mot de passe seed) |
| Pharmacie | `/login?access=pharmacy` | `pharmacy@haircare.com` / (mot de passe seed) |

- [ ] Créer une cliente (formulaire)
- [ ] Ouvrir `/diagnostic` avec l’ID généré
- [ ] Créer une commande pharmacie
- [ ] Vérifier le dashboard KPIs

### 4. CORS / réseau

- [ ] F12 → Network : appels vers `…/api/…` en **200**, pas d’erreur CORS
- [ ] Pas d’appel vers `localhost:8000`

---

## F. Sécurité post-go-live (à cocher)

- [ ] Changer **immédiatement** les mots de passe seed (admin, pharma, conseillère)
- [ ] Ne plus documenter les mots de passe prod dans le README
- [ ] Désactiver ou restreindre `/docs` en prod si tu veux moins d’exposition (optionnel)
- [ ] Activer backups Postgres (Railway/Render)
- [ ] Cron backup optionnel :

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db ./backend/scripts/backup.sh
```

- [ ] Domaine custom + HTTPS (Vercel / Railway)
- [ ] Vérifier que `.env` / `.env.local` ne sont **pas** dans Git

---

## G. Récap des URLs à garder

| Élément | URL |
|---------|-----|
| Frontend Vercel | `https://________.vercel.app` |
| Backend API | `https://________` |
| Swagger | `https://________/docs` |
| Health | `https://________/health` |
| Diagnostic public | `https://________/diagnostic` |

---

## H. Dépannage rapide

| Problème | Cause probable | Action |
|----------|----------------|--------|
| CORS error dans le navigateur | `CORS_ORIGINS` ≠ URL Vercel | Corriger + redeploy backend |
| Login échoue / Network Error | Mauvaise `NEXT_PUBLIC_API_URL` | Doit finir par `/api` + redeploy Vercel |
| 500 au démarrage backend | `DATABASE_URL` invalide | Vérifier Postgres + SSL si demandé (`?sslmode=require`) |
| Build Vercel échoue | Root Directory ≠ `frontend` | Mettre Root = `frontend` |
| Tables manquantes | 1er boot OK via `create_all` | Relancer le service ; vérifier logs seed |

---

## Ordre minimal “copier-coller”

```text
1. Créer Postgres (Railway/Render) → copier DATABASE_URL
2. Déployer backend/ → coller variables (SECRET_KEY, DATABASE_URL, APP_ENV=production…)
3. Tester /health
4. Déployer frontend/ sur Vercel → NEXT_PUBLIC_API_URL=https://BACKEND/api
5. Mettre CORS_ORIGINS + FRONTEND_URL = URL Vercel → redeploy backend
6. Tester login admin + diagnostic + pharmacie
7. Changer tous les mots de passe
```
