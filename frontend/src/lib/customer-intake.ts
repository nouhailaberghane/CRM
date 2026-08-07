import type { Customer } from "@/lib/types";
import type { IntakeFormValues } from "@/components/customers/customer-intake-form";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Convertit une fiche cliente API en valeurs du formulaire d’admission. */
export function customerToIntakeValues(customer: Customer): IntakeFormValues {
  const q = asRecord(customer.questionnaire);
  const desc = asRecord(q.description_probleme);
  const nature = asRecord(q.nature_cheveux);
  const frove = asRecord(q.nature_frove);
  const meds = asRecord(q.medicaments);
  const comps = asRecord(q.complements);
  const soins = asRecord(q.soins_cheveux);
  const nutrition = asRecord(q.nutrition);
  const labs = asRecord(q.analyses_medicales);

  return {
    advisor_name: customer.advisor_name || "",
    full_name: customer.full_name || `${customer.first_name} ${customer.last_name}`.trim(),
    birth_date: customer.birth_date || "",
    gender: customer.gender || "أنثى",
    city: customer.city || "",
    phone: customer.phone || "",
    notes: customer.notes || "",
    questionnaire: {
      ...q,
      description_probleme: desc,
      nature_cheveux: nature,
      nature_frove: frove,
      medicaments: meds,
      complements: comps,
      soins_cheveux: soins,
      nutrition,
      analyses_medicales: labs,
      raisons_contact: asStringArray(q.raisons_contact),
      lieu_probleme: asStringArray(q.lieu_probleme),
      historique_sante: asStringArray(q.historique_sante),
      evenements_precedents: asStringArray(q.evenements_precedents),
      facteurs: asStringArray(q.facteurs),
    },
  };
}
