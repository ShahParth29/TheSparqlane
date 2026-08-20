from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.database import Base, engine, SessionLocal
from app.core.config import get_settings
from app.models.models import Video, ClientEnquiry, BlogPost, PricingPlan, SiteSettings
from app.routers import videos, contact, blog, pricing, settings

# ── Create tables ──────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

settings_cfg = get_settings()

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="The SparQlane — Media House & Agency API",
    description="Backend API for The SparQlane creative agency, PR, influencer marketing & cinematic studio",
    version="2.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# ── Security Headers Middleware ────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; "
        "img-src 'self' https: data: blob:; "
        "media-src 'self' https: data: blob:; "
        "frame-src 'self' https://www.youtube.com https://youtube.com;"
    )
    return response

# ── CORS ───────────────────────────────────────────────────────────────────────
origins = ["*"]
if settings_cfg.CORS_ORIGINS != "*":
    origins = [origin.strip() for origin in settings_cfg.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(videos.router)
app.include_router(contact.router)
app.include_router(blog.router)
app.include_router(pricing.router)
app.include_router(settings.router)

@app.get("/api/health")
def health_check():
    import os
    env_keys = list(os.environ.keys())
    db_url_masked = "none"
    if settings_cfg.DATABASE_URL:
        db_url_masked = settings_cfg.DATABASE_URL.split("@")[-1] if "@" in settings_cfg.DATABASE_URL else settings_cfg.DATABASE_URL
    return {
        "status": "ok",
        "service": "The SparQlane API",
        "debug": {
            "env_keys": [k for k in env_keys if "SECRET" not in k and "PASS" not in k and "KEY" not in k],
            "has_admin_user": settings_cfg.ADMIN_USERNAME is not None,
            "admin_user": settings_cfg.ADMIN_USERNAME,
            "has_admin_pass": settings_cfg.ADMIN_PASSWORD is not None,
            "admin_pass_len": len(settings_cfg.ADMIN_PASSWORD) if settings_cfg.ADMIN_PASSWORD else 0,
            "db_url_masked": db_url_masked,
            "storage_backend": settings_cfg.STORAGE_BACKEND,
        }
    }


# ── Seed Data ──────────────────────────────────────────────────────────────────
def seed_data():
    """Insert sample data on first run so the site is not empty."""
    db = SessionLocal()
    try:
        # Seed Settings if empty
        if db.query(SiteSettings).count() == 0:
            default_settings = {
                "site_name": "The Sparqlane",
                "tagline": "WHERE STORY MEETS CREATIVITY",
                "email": "contact@thesparqlane.com",
                "phone": "+91 81410 50770",
                "location": "Ahmedabad, Gujarat, India",
                "youtube": "#",
                "instagram": "https://instagram.com/thesparqlane",
                "twitter": "https://x.com/thesparqlane",
                "about_text": "Premier digital agency specializing in Influencer Marketing, PR, Media House coverage, Social Media Management, and Cinematic Shoots.",
                "about_bio": "The Sparqlane is where story meets creativity. We are a full-service creative agency, PR powerhouse, and cinematic production house. We elevate brands through strategic influencer management, local media channels, viral social media campaigns, and cinema-grade visual storytelling spanning travel, food, fashion, beauty, lifestyle, fitness, business, history, and exploration.",
            }
            for k, v in default_settings.items():
                db.add(SiteSettings(key=k, value=v))
            db.commit()
            print("[SEED] Site settings seeded for The Sparqlane.")
        else:
            # Migration/Upgrade check for existing databases
            site_name_setting = db.query(SiteSettings).filter(SiteSettings.key == "site_name").first()
            if site_name_setting:
                site_name_setting.value = "The Sparqlane"
                db.commit()
                print("[MIGRATION] Site settings upgraded name to The Sparqlane.")
                
            tagline_setting = db.query(SiteSettings).filter(SiteSettings.key == "tagline").first()
            if tagline_setting:
                tagline_setting.value = "WHERE STORY MEETS CREATIVITY"
                db.commit()
                print("[MIGRATION] Site settings upgraded tagline to WHERE STORY MEETS CREATIVITY.")
                
            about_text_setting = db.query(SiteSettings).filter(SiteSettings.key == "about_text").first()
            if about_text_setting:
                about_text_setting.value = "Premier digital agency specializing in Influencer Marketing, PR, Media House coverage, Social Media Management, and Cinematic Shoots."
                db.commit()
                print("[MIGRATION] Site settings upgraded about_text.")
                
            about_bio_setting = db.query(SiteSettings).filter(SiteSettings.key == "about_bio").first()
            if about_bio_setting:
                about_bio_setting.value = "The Sparqlane is where story meets creativity. We are a full-service creative agency, PR powerhouse, and cinematic production house. We elevate brands through strategic influencer management, local media channels, viral social media campaigns, and cinema-grade visual storytelling spanning travel, food, fashion, beauty, lifestyle, fitness, business, history, and exploration."
                db.commit()
                print("[MIGRATION] Site settings upgraded about_bio.")

            # Migrate blog post contents
            blog_posts = db.query(BlogPost).all()
            for post in blog_posts:
                updated = False
                for old_name in ["The SparQlane", "NPJ Productions", "NextFrame Studios", "Aurevia Films", "Dhruvam Productions"]:
                    if old_name in post.content:
                        post.content = post.content.replace(old_name, "The Sparqlane")
                        updated = True
                if updated:
                    db.add(post)
            db.commit()

        # Only seed if the videos table is empty
        if db.query(Video).count() > 0:
            return

        # No sample YouTube videos — only user-uploaded videos will be shown
        # (Seed video section removed to keep site clean)

        # ── Sample Pricing Plans ───────────────────────────────────────────
        if db.query(PricingPlan).count() == 0:
            db.add_all([
                PricingPlan(
                    name="Post-Production & Grading Suite",
                    price=8000,
                    original_price=12000,
                    features="Up to 5 min cinematic edit,Advanced DaVinci color grading,Sound design & SFX mix,4K UHD final rendering,3 review sessions,4-day delivery",
                    is_popular=False,
                ),
                PricingPlan(
                    name="Commercial Video Production",
                    price=25000,
                    original_price=35000,
                    features="Professional commercial shoot,RED/Sony FX camera package,High-end studio lighting,Cinema post-production & grading,Multi-platform deliverables,5-day delivery",
                    is_popular=True,
                ),
                PricingPlan(
                    name="Corporate Storytelling & Brand Ads",
                    price=40000,
                    original_price=55000,
                    features="Scriptwriting & pre-production,1-day brand documentary shoot,Custom graphic elements & titles,Full post-production & sound design,Standard marketing license,7-day delivery",
                    is_popular=False,
                ),
                PricingPlan(
                    name="Cinematic Film & Weddings",
                    price=50000,
                    original_price=70000,
                    features="Multi-camera wedding documentary shoot,Professional cine drone coverage (DJI),Cinema-grade color grading,Custom narrative storytelling edit,Premium audio recording & SFX,10-day delivery",
                    is_popular=False,
                ),
            ])

        # ── Sample Blog Post ──────────────────────────────────────────────
        if db.query(BlogPost).filter(BlogPost.slug == "5-color-grading-tips").count() == 0:
            db.add(BlogPost(
                title="5 Color Grading Tips for Cinematic Videos",
            slug="5-color-grading-tips",
            content="""## Introduction

Color grading can make or break your video. Here are my top 5 tips that I use on every project.

## 1. Start with a Clean Base

Before applying any creative LUT, make sure your footage is properly **white-balanced** and **exposure-corrected**. This gives you a clean canvas to work with.

## 2. Use Power Windows for Skin Tones

Isolate skin tones using qualifier tools in DaVinci Resolve. This lets you adjust the background mood without affecting how people look on screen.

## 3. Embrace the Teal & Orange Look

The classic cinematic look pairs cool shadows (teal) with warm highlights (orange). It works because it creates natural contrast with skin tones.

## 4. Don't Over-Saturate

Less is more. Pull back on saturation and let the contrast do the heavy lifting. Over-saturated footage looks amateur.

## 5. Match Your Shots

Consistency across shots is more important than any single grade. Use DaVinci Resolve's **Shot Match** feature to maintain a cohesive look.

---

*Happy grading! — NPJ Productions*
""",
            cover_image_url="https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800",
            category="tips",
            is_published=True,
            ))

        db.commit()
        print("[SEED] Sample data inserted successfully.")
    except Exception as exc:
        db.rollback()
        print(f"[SEED] Error: {exc}")
    finally:
        db.close()


seed_data()


# ── Serve uploads and frontend (optional, for local dev) ──────────────────────
import os

try:
    upload_dir = settings_cfg.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")
except Exception as e:
    print(f"[STATIC] Local uploads dir creation skipped (likely read-only environment): {e}")

try:
    frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
    if os.path.isdir(frontend_dir):
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
except Exception as e:
    print(f"[STATIC] Local frontend mounting skipped: {e}")

