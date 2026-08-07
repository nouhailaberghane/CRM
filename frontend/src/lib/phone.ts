/** Numéro marocain local : commence par 0, exactement 10 chiffres. */

export const PHONE_ERROR =
  "رقم الهاتف يجب أن يبدأ بـ 0 ويحتوي على 10 أرقام بالضبط (مثال: 0612345678)";

export const PHONE_CONFIRM_ERROR = "رقما الهاتف غير متطابقين";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function isValidLocalPhone(phone: string): boolean {
  return /^0\d{9}$/.test(phone);
}

export function validatePhonePair(phone: string, phoneConfirm: string): string | null {
  if (!isValidLocalPhone(phone)) return PHONE_ERROR;
  if (phone !== phoneConfirm) return PHONE_CONFIRM_ERROR;
  return null;
}
