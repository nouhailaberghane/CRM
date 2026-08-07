from io import BytesIO
from typing import Iterable

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.entities import Customer
from app.schemas.dashboard import DashboardResponse


def export_customers_excel(customers: Iterable[Customer]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Customers"
    ws.append(
        [
            "Customer Code",
            "First Name",
            "Last Name",
            "Phone",
            "Email",
            "City",
            "Age",
            "Hair Type",
            "Humidity",
            "Advisor ID",
            "Created At",
        ]
    )
    for c in customers:
        ws.append(
            [
                c.customer_code,
                c.first_name,
                c.last_name,
                c.phone,
                c.email or "",
                c.city,
                c.age,
                c.hair_type,
                c.humidity if c.humidity is not None else "",
                c.advisor_id,
                c.created_at.isoformat() if c.created_at else "",
            ]
        )
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def export_dashboard_pdf(dashboard: DashboardResponse) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Kenza trichologist center — Dashboard Report", styles["Title"]),
        Spacer(1, 12),
        Paragraph("Key Performance Indicators", styles["Heading2"]),
    ]

    k = dashboard.kpis
    data = [
        ["Metric", "Value"],
        ["Total Customers", str(k.total_customers)],
        ["Customers Today", str(k.customers_today)],
        ["Diagnostics Completed", str(k.diagnostics_completed)],
        ["Average Humidity", f"{k.average_humidity}%" if k.average_humidity is not None else "N/A"],
        ["Orders", str(k.total_orders)],
        ["Revenue", f"{k.revenue:.2f}"],
        ["Average Order Value", f"{k.average_order_value:.2f}" if k.average_order_value else "N/A"],
        ["Conversion Rate", f"{k.conversion_rate}%"],
    ]
    table = Table(data, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2F6F4E")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F7FBF8")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F7FBF8"), colors.white]),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 18))

    pk = dashboard.pharmacy_kpis
    story.append(Paragraph("Pharmacy Order Tracking KPIs", styles["Heading2"]))
    pharmacy_data = [
        ["Metric", "Value"],
        ["Total pharmacy orders", str(pk.total)],
        ["Orders today", str(pk.today)],
        ["In progress", str(pk.in_progress)],
        ["Delivered", str(pk.livree)],
        ["Returned", str(pk.retournee)],
        ["Cancelled", str(pk.annulee)],
        ["Delivery rate", f"{pk.delivery_rate}%"],
        ["Revenue delivered", f"{pk.revenue_delivered:.2f}"],
        ["Revenue all statuses", f"{pk.revenue_total:.2f}"],
    ]
    for s in pk.by_status:
        pharmacy_data.append([f"Status: {s.label}", f"{s.count} / {s.revenue:.2f}"])
    pharmacy_table = Table(pharmacy_data, hAlign="LEFT")
    pharmacy_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2F6F4E")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F7FBF8")),
            ]
        )
    )
    story.append(pharmacy_table)
    story.append(Spacer(1, 18))

    story.append(Paragraph("Top Products", styles["Heading2"]))
    product_data = [["Product", "Quantity"]] + [[p.name, str(p.value)] for p in dashboard.top_products]
    product_table = Table(product_data or [["Product", "Quantity"], ["—", "0"]], hAlign="LEFT")
    product_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2F6F4E")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(product_table)
    doc.build(story)
    return buffer.getvalue()
