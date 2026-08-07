import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import advisors, audit, auth, catalog, customers, dashboard, diagnostic, orders
from app.config import get_settings
from app.database import Base, engine
from app.db_migrate import ensure_order_columns
from app.seed import seed_database
from app.services.trash import purge_expired_trash

settings = get_settings()


async def _trash_purge_loop(stop: asyncio.Event) -> None:
    """Purge horaire des éléments en corbeille depuis plus de 48 h."""
    while not stop.is_set():
        try:
            await purge_expired_trash()
        except Exception:
            pass
        try:
            await asyncio.wait_for(stop.wait(), timeout=3600)
        except asyncio.TimeoutError:
            continue


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await ensure_order_columns(conn)
    # Comptes de base + catalogue. Pas de données clientes fictives.
    await seed_database()
    await purge_expired_trash()
    stop = asyncio.Event()
    task = asyncio.create_task(_trash_purge_loop(stop))
    try:
        yield
    finally:
        stop.set()
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title=settings.app_name,
    description="Kenza trichologist center — CRM & Customer Diagnostic API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(advisors.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(catalog.programs_router, prefix="/api")
app.include_router(catalog.products_router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(diagnostic.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(audit.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
