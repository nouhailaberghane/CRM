from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import select

from app.core.deps import DbSession
from app.models.entities import Customer
from app.schemas.customer import CustomerLookupOut, DiagnosticResult
from app.services.audit import log_action
from app.services.diagnostic import process_diagnostic

router = APIRouter(prefix="/diagnostic", tags=["Diagnostic"])

ALREADY_DONE_MSG = "تم إجراء التشخيص مسبقاً. يُسمح بتحليل واحد فقط لكل عميلة."


def _has_diagnostic(customer: Customer) -> bool:
    return customer.humidity is not None or customer.humidity_measured_at is not None


@router.get("/lookup/{customer_code}", response_model=CustomerLookupOut)
async def lookup_customer(customer_code: str, db: DbSession):
    result = await db.execute(
        select(Customer).where(
            Customer.customer_code == customer_code.strip().upper(),
            Customer.deleted_at.is_(None),
        )
    )
    customer = result.scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="المعرّف غير موجود")

    full = getattr(customer, "full_name", None) or f"{customer.first_name} {customer.last_name}".strip()
    first = customer.first_name or (full.split()[0] if full else "")
    done = _has_diagnostic(customer)

    return CustomerLookupOut(
        customer_code=customer.customer_code,
        first_name=first,
        full_name=full,
        valid=True,
        diagnostic_done=done,
        humidity=customer.humidity if done else None,
        humidity_measured_at=customer.humidity_measured_at if done else None,
        analysis_algorithm_version=getattr(customer, "analysis_algorithm_version", None) if done else None,
        message=ALREADY_DONE_MSG if done else None,
    )


@router.post("/analyze", response_model=DiagnosticResult)
async def analyze_hair(
    db: DbSession,
    customer_code: str = Form(...),
    image: UploadFile = File(...),
):
    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image upload")
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    del content

    try:
        customer, humidity, measured_at, algo = await process_diagnostic(
            db, customer_code.strip().upper()
        )
    except ValueError as exc:
        msg = str(exc)
        if "مسبقاً" in msg or "déjà" in msg.lower() or "already" in msg.lower():
            raise HTTPException(status_code=409, detail=ALREADY_DONE_MSG) from exc
        raise HTTPException(status_code=404, detail=msg) from exc

    await log_action(
        db,
        user_id=None,
        action="diagnostic_completed",
        entity_type="customer",
        entity_id=customer.customer_code,
        details={"humidity": humidity, "image_stored": False, "algorithm": algo},
    )
    return DiagnosticResult(
        customer_code=customer.customer_code,
        humidity=humidity,
        measured_at=measured_at,
        analysis_algorithm_version=algo,
    )
