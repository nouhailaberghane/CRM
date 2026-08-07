"""Normalisation et validation des numéros marocains."""

import re

PHONE_LOCAL_RE = re.compile(r"^0\d{9}$")
PHONE_ERROR_AR = "رقم الهاتف يجب أن يبدأ بـ 0 ويحتوي على 10 أرقام بالضبط (مثال: 0612345678)"


def phone_digits(phone: str | None) -> str:
    if not phone:
        return ""
    return "".join(ch for ch in phone if ch.isdigit())


def normalize_phone_key(phone: str | None) -> str:
    """Clé comparable : derniers 9 chiffres (sans indicatif 212 / 0)."""
    digits = phone_digits(phone)
    if not digits:
        return ""
    if digits.startswith("212") and len(digits) >= 12:
        digits = digits[3:]
    if digits.startswith("0") and len(digits) >= 9:
        digits = digits[1:]
    return digits[-9:] if len(digits) >= 9 else digits


def is_valid_local_phone(phone: str | None) -> bool:
    """Doit commencer par 0 et contenir exactement 10 chiffres."""
    if not phone:
        return False
    return bool(PHONE_LOCAL_RE.fullmatch(phone.strip()))


def validate_local_phone(phone: str) -> str:
    cleaned = phone.strip()
    if not is_valid_local_phone(cleaned):
        raise ValueError(PHONE_ERROR_AR)
    return cleaned
