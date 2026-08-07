from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def ensure_order_columns(conn: AsyncConnection) -> None:
    dialect = conn.engine.dialect.name
    if dialect == "sqlite":
        await _sqlite_add_columns(conn, "orders", {
            "source": "VARCHAR(30) NOT NULL DEFAULT 'message'",
            "notes": "TEXT",
            "registered_by_user_id": "INTEGER",
            "customer_name": "VARCHAR(200)",
            "city": "VARCHAR(100)",
            "address": "TEXT",
            "product_type": "VARCHAR(100)",
            "deleted_at": "DATETIME",
        })
        await _sqlite_add_columns(conn, "customers", {
            "full_name": "VARCHAR(200) NOT NULL DEFAULT ''",
            "birth_date": "DATE",
            "gender": "VARCHAR(20)",
            "care_plan": "JSON",
            "recommended_catalog": "JSON",
            "status": "VARCHAR(40) NOT NULL DEFAULT 'nouvelle'",
            "analysis_algorithm_version": "VARCHAR(50)",
            "deleted_at": "DATETIME",
        })
        await _sqlite_add_columns(conn, "advisors", {
            "advisor_code": "VARCHAR(20) NOT NULL DEFAULT ''",
        })
    elif dialect == "postgresql":
        for stmt in [
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'message'",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS registered_by_user_id INTEGER",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_type VARCHAR(100)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name VARCHAR(200) NOT NULL DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date DATE",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS care_plan JSONB",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS recommended_catalog JSONB",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'nouvelle'",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS analysis_algorithm_version VARCHAR(50)",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
            "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS advisor_code VARCHAR(20) NOT NULL DEFAULT ''",
        ]:
            await conn.execute(text(stmt))


async def _sqlite_add_columns(conn: AsyncConnection, table: str, columns: dict[str, str]) -> None:
    result = await conn.execute(text(f"PRAGMA table_info({table})"))
    existing = {row[1] for row in result.fetchall()}
    for name, ddl in columns.items():
        if name not in existing:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
