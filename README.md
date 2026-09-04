# ✨ The Sparqlane — Where Story Meets Creativity

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Vercel](https://img.shields.io/badge/Deployment-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-10B981?style=for-the-badge)]()

**A modern, production-grade web platform for The Sparqlane — a premier agency specializing in Influencer Marketing, PR, Media House coverage, Local Media Updates, Social Media Management, and Cinematic Shoots.**

[Live Demo](https://thesparqlane.com) • [Explore Features](#-features) • [Quick Start](#-quick-start) • [Deployment](#-deployment) • [API Docs](#-api-endpoints)

---

</div>

## 📖 Overview

**The Sparqlane** is an end-to-end agency and portfolio platform engineered with a high-performance Python FastAPI backend and an ultra-responsive, aesthetic, dark-mode frontend. Designed to convey luxury, creativity, and cinematic authority, the platform empowers the agency to showcase campaigns, manage client inquiries, publish media insights, and administer agency content securely.

---

## 🌟 Key Features

### 🎨 Frontend Experience
- **Cinematic & Modern Aesthetic**: Curated obsidian/gold typography, glassmorphism card surfaces, and fluid micro-animations.
- **Dynamic Portfolio Showcase**: Interactive filterable media gallery supporting YouTube embeds, direct video uploads, and campaign highlights.
- **Instant Custom Quote Modal**: Interactive multi-step estimator for influencer marketing, PR campaigns, car delivery shoots, and media packages.
- **Blog & Media House Hub**: Markdown-powered article system with category filtering, reading time estimates, and SEO-optimized metadata.
- **Spam-Resistant Booking Form**: Dual-layer client-side + server-side honeypot spam traps with real-time feedback.
- **Automated Asset Optimizer**: Python-powered build step (`build.py`) that minifies HTML, CSS, and JS before production deployment.

### ⚡ Backend & Infrastructure
- **FastAPI Engine**: Asynchronous, lightweight, and high-throughput Python backend.
- **Database & ORM**: SQLAlchemy ORM with SQLite for local development and direct pluggability with PostgreSQL / Supabase for enterprise scale.
- **Multi-Cloud Storage**: Seamless support for Cloudinary CDN, AWS S3 / Cloudflare R2, and local filesystem storage.
- **Email Dispatcher**: Automated, styled HTML notification emails for new client leads with SMTP (Gmail, SendGrid, Resend, Web3Forms fallback).

### 🔒 Enterprise-Grade Security
- **JWT Authentication**: Secure Bearer tokens with configurable expiration (HS256).
- **Password Security**: Bcrypt hashing with salted iterations.
- **Progressive Adaptive Rate Limiting**: Exponential backoff protection against brute-force login attempts (30s → 2m → 8m → 30m).
- **Security Headers & CORS**: Strict `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and origin isolation.
- **Hidden Admin Surface**: `noindex, nofollow` metadata headers and endpoint access controls.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Semantic HTML5, Vanilla CSS3 (Custom Design System), Modern JavaScript (ES6+), Marked.js |
| **Backend** | Python 3.10+, FastAPI, Pydantic v2, Starlette |
| **Database** | SQLite3 (Development / Single-file) / PostgreSQL Ready (SQLAlchemy ORM) |
| **Authentication** | OAuth2 Bearer JWT (`python-jose`), Passlib with `bcrypt` |
| **Cloud Storage** | Cloudinary CDN / AWS S3 / Cloudflare R2 |
| **Email & Alerts** | Asynchronous SMTP with TLS / Web3Forms fallback |
| **Build & Optimization** | Custom AST/Regex-based Python Minifier (`build.py`) |
| **Hosting** | Vercel Serverless API & Static Edge, Render |

---

## 📁 Project Structure

```
the-sparqlane/
├── api/
│   └── index.py             # Vercel serverless entry point
├── app/
│   ├── core/
│   │   ├── auth.py          # JWT authentication & password verification
│   │   ├── config.py        # Pydantic settings & environment configuration
│   │   ├── database.py      # SQLAlchemy session & engine lifecycle
│   │   ├── email.py         # SMTP email dispatcher & HTML email templates
│   │   └── storage.py       # Cloudinary & Local file storage abstraction
│   ├── models/
│   │   └── models.py        # Database models (Videos, Posts, Quotes, Settings)
│   ├── routers/
│   │   ├── blog.py          # Blog CRUD & slug query endpoints
│   │   ├── contact.py       # Contact submission, rate limiter & auth routes
│   │   ├── pricing.py       # Services & pricing CRUD endpoints
│   │   ├── settings.py      # Dynamic site configuration endpoints
│   │   └── videos.py        # Video portfolio management & file uploads
│   ├── schemas/
│   │   └── schemas.py       # Pydantic request/response models
│   └── main.py              # FastAPI application bootstrap & seeding
├── frontend/
│   ├── css/
│   │   └── style.css        # Core stylesheet & design tokens
│   ├── js/
│   │   ├── admin.js         # Admin dashboard logic
│   │   ├── api.js           # API client, dynamic data loaders & quote modal
│   │   └── gallery.js       # Dynamic portfolio filter & video modal
│   ├── img/                 # Logos, favicons & brand assets
│   ├── index.html           # Landing page & agency showcase
│   ├── works.html           # Media & cinematic portfolio gallery
│   ├── about.html           # Story, leadership & agency vision
│   ├── pricing.html         # Custom pricing calculator & packages
│   ├── blog.html            # Media insights & blog index
│   ├── post.html            # Dynamic single article view
│   ├── contact.html         # Project booking & inquiry form
│   ├── admin.html           # Secure administrative dashboard
│   ├── robots.txt           # Search crawler directives
│   └── sitemap.xml          # XML sitemap
├── build.py                 # Automated HTML/CSS/JS minifier & bundler
├── vercel.json              # Vercel deployment & serverless route configuration
├── render.yaml              # Render cloud infrastructure blueprint
├── requirements.txt         # Python dependencies
└── README.md                # Project documentation
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Python**: 3.10 or higher
- **Git**: Installed on your system

### 2. Clone & Setup

```bash
# Clone the repository
git clone https://github.com/ShahParth29/TheSparqlane.git
cd TheSparqlane

# Create and activate virtual environment
python -m venv venv

# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

Create a `.env` file from the provided `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
SECRET_KEY=your_generated_secret_key_here
SPARQLANE_ADMIN_USERNAME=PNG
SPARQLANE_ADMIN_PASSWORD=your_secure_password

# Email configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=your_email@gmail.com
EMAIL_TO=thesparqlane@gmail.com

# Storage (optional: "local" or "cloudinary")
STORAGE_BACKEND=local
```

### 4. Run the Application

```bash
uvicorn app.main:app --reload --port 8000
```

Open your browser and navigate to:
- **Website**: `http://localhost:8000`
- **Interactive API Docs (Swagger)**: `http://localhost:8000/docs`
- **Admin Portal**: `http://localhost:8000/admin.html`

---

## 🔐 Environment Variables

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `DATABASE_URL` | ✅ | `sqlite:///./portfolio.db` | SQLAlchemy connection string |
| `SECRET_KEY` | ✅ | — | JWT signing key (generate via `secrets.token_urlsafe(64)`) |
| `SPARQLANE_ADMIN_USERNAME` | ✅ | `PNG` | Administrative dashboard login username |
| `SPARQLANE_ADMIN_PASSWORD` | ✅ | — | Administrative dashboard login password |
| `SMTP_HOST` | ❌ | `smtp.gmail.com` | Outgoing SMTP mail server |
| `SMTP_PORT` | ❌ | `587` | Outgoing SMTP port (TLS) |
| `SMTP_USER` | ❌ | — | Mail account username |
| `SMTP_PASSWORD` | ❌ | — | Mail account app password |
| `EMAIL_TO` | ❌ | `thesparqlane@gmail.com` | Lead notification destination address |
| `STORAGE_BACKEND` | ❌ | `local` | Storage provider (`local`, `cloudinary`, `s3`) |
| `CLOUDINARY_CLOUD_NAME` | ❌* | — | Required if `STORAGE_BACKEND=cloudinary` |
| `CLOUDINARY_API_KEY` | ❌* | — | Required if `STORAGE_BACKEND=cloudinary` |
| `CLOUDINARY_API_SECRET` | ❌* | — | Required if `STORAGE_BACKEND=cloudinary` |
| `CORS_ORIGINS` | ❌ | `*` | Comma-separated allowed CORS origins |

---

## 🌐 Deployment

### Deploying to Vercel (Recommended)

This project is configured out-of-the-box for zero-configuration serverless deployment on Vercel via [`vercel.json`](vercel.json):

1. **Push to GitHub**: Ensure your code is pushed to your GitHub repository.
2. **Connect to Vercel**: Import the project repository in your [Vercel Dashboard](https://vercel.com).
3. **Build & Output Settings**:
   - **Build Command**: `python build.py`
   - **Output Directory**: `dist`
4. **Environment Variables**: Add your production variables (`SECRET_KEY`, `SPARQLANE_ADMIN_USERNAME`, `SPARQLANE_ADMIN_PASSWORD`, `SMTP_*`, etc.) under Project Settings → Environment Variables.
5. **Deploy**: Hit Deploy. Vercel will automatically build the minified frontend and mount the serverless Python API handlers.

---

## 📡 API Endpoints

### Public Routes
- `GET /api/videos` — Retrieve published portfolio video list
- `GET /api/blog` — List published blog articles
- `GET /api/blog/{slug}` — Retrieve single article by slug
- `GET /api/pricing` — List services and packages
- `GET /api/settings` — Get dynamic site metadata and branding
- `POST /api/contact` — Submit client inquiry (Protected by Rate Limiter & Honeypot)
- `POST /api/auth/token` — Admin login and JWT token generation

### Admin Routes (Protected by `Bearer <JWT>`)
- `POST /api/videos` / `PUT /api/videos/{id}` / `DELETE /api/videos/{id}` — Video CRUD
- `POST /api/videos/upload` — Direct media file upload
- `POST /api/blog` / `PUT /api/blog/{id}` / `DELETE /api/blog/{id}` — Blog CRUD
- `PUT /api/settings` — Update global site settings and copy

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<div align="center">

Made with ❤️ by **The Sparqlane Team**  
*Where Story Meets Creativity*

</div>
