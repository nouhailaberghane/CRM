"use client";

import { useEffect, useState } from "react";
import {
  CITIES,
  CONTACT_REASONS,
  FRUIT_VEG,
  HAIR_DENSITY,
  HAIR_LENGTH,
  HAIR_TYPES,
  HEALTH_HISTORY,
  INFLUENCING_FACTORS,
  MEDICAL_LABS,
  POROSITY,
  PRECEDING_EVENTS,
  PROBLEM_DURATION,
  PROBLEM_LOCATIONS,
  PROBLEM_START,
  PROTEIN_INTAKE,
  SCALP_ISSUES,
  SCALP_TYPES,
  SUPPLEMENTS,
  USED_PRODUCTS,
  WASH_FREQUENCY,
  WATER_TEMP,
  toggleInList,
} from "@/lib/customer-form-options";
import { digitsOnly, validatePhonePair } from "@/lib/phone";

export interface IntakeFormValues {
  advisor_name: string;
  full_name: string;
  birth_date: string;
  gender: string;
  city: string;
  phone: string;
  notes?: string;
  questionnaire: Record<string, unknown>;
}

interface Props {
  advisorNames: { id: number; name: string; advisor_code?: string }[];
  submitting?: boolean;
  error?: string;
  initialValues?: IntakeFormValues | null;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (values: IntakeFormValues) => void;
}

function asArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-3 p-5">
      <h3 className="text-lg font-semibold text-[var(--primary)]" dir="rtl">
        {title}
      </h3>
      <div className="space-y-3" dir="rtl">
        {children}
      </div>
    </section>
  );
}

function CheckGroup({
  options,
  values,
  onChange,
}: {
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.includes(opt)}
            onChange={() => onChange(toggleInList(values, opt))}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function RadioGroup({
  options,
  value,
  onChange,
  name,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2">
          <input type="radio" name={name} checked={value === opt} onChange={() => onChange(opt)} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

export function CustomerIntakeForm({
  advisorNames,
  submitting,
  error,
  initialValues,
  submitLabel,
  onCancel,
  onSubmit,
}: Props) {
  const [advisorName, setAdvisorName] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("أنثى");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConfirm, setPhoneConfirm] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [notes, setNotes] = useState("");

  const [raisons, setRaisons] = useState<string[]>([]);
  const [raisonAutre, setRaisonAutre] = useState("");
  const [depuisQuand, setDepuisQuand] = useState(PROBLEM_DURATION[0]);
  const [commentCommence, setCommentCommence] = useState("تدريجياً");
  const [severite, setSeverite] = useState(5);
  const [lieux, setLieux] = useState<string[]>([]);
  const [typeCheveux, setTypeCheveux] = useState(HAIR_TYPES[0]);
  const [densite, setDensite] = useState(HAIR_DENSITY[1]);
  const [longueur, setLongueur] = useState(HAIR_LENGTH[1]);
  const [typeFrove, setTypeFrove] = useState(SCALP_TYPES[0]);
  const [problemesFrove, setProblemesFrove] = useState<string[]>([]);
  const [historique, setHistorique] = useState<string[]>([]);
  const [medicamentsOui, setMedicamentsOui] = useState("لا");
  const [medicamentNom, setMedicamentNom] = useState("");
  const [medicamentDepuis, setMedicamentDepuis] = useState("");
  const [supplementsOui, setSupplementsOui] = useState("لا");
  const [supplements, setSupplements] = useState<string[]>([]);
  const [evenements, setEvenements] = useState<string[]>([]);
  const [lavage, setLavage] = useState(WASH_FREQUENCY[1]);
  const [produitsUtilises, setProduitsUtilises] = useState<string[]>([]);
  const [chaleurEau, setChaleurEau] = useState(WATER_TEMP[1]);
  const [facteurs, setFacteurs] = useState<string[]>([]);
  const [proteine, setProteine] = useState(PROTEIN_INTAKE[1]);
  const [fruits, setFruits] = useState(FRUIT_VEG[1]);
  const [eauLitres, setEauLitres] = useState("1.5");
  const [porosite, setPorosite] = useState(POROSITY[3]);
  const [labos, setLabos] = useState<string[]>([]);
  const [labValues, setLabValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialValues) return;
    setAdvisorName(initialValues.advisor_name || "");
    setFullName(initialValues.full_name || "");
    setBirthDate(initialValues.birth_date || "");
    setGender(initialValues.gender || "أنثى");
    setCity(initialValues.city || "");
    const initialPhone = digitsOnly(initialValues.phone || "");
    setPhone(initialPhone);
    setPhoneConfirm(initialPhone);
    setPhoneError("");
    setNotes(initialValues.notes || "");

    const q = asObj(initialValues.questionnaire);
    const raisonsRaw = asArr(q.raisons_contact);
    const autre = raisonsRaw.find((r) => r.startsWith("أخرى"));
    setRaisons(
      autre
        ? [...raisonsRaw.filter((r) => !r.startsWith("أخرى")), "أخرى"]
        : raisonsRaw
    );
    setRaisonAutre(autre ? autre.replace(/^أخرى:\s*/, "") : "");

    const desc = asObj(q.description_probleme);
    setDepuisQuand(String(desc.depuis_quand || PROBLEM_DURATION[0]));
    setCommentCommence(String(desc.comment_commence || "تدريجياً"));
    setSeverite(Number(desc.severite) || 5);
    setLieux(asArr(q.lieu_probleme));

    const nature = asObj(q.nature_cheveux);
    setTypeCheveux(String(nature.type_cheveux || HAIR_TYPES[0]));
    setDensite(String(nature.densite || HAIR_DENSITY[1]));
    setLongueur(String(nature.longueur || HAIR_LENGTH[1]));

    const frove = asObj(q.nature_frove);
    setTypeFrove(String(frove.type_frove || SCALP_TYPES[0]));
    setProblemesFrove(asArr(frove.problemes));
    setHistorique(asArr(q.historique_sante));

    const meds = asObj(q.medicaments);
    setMedicamentsOui(meds.prend_medicaments ? "نعم" : "لا");
    setMedicamentNom(String(meds.nom || ""));
    setMedicamentDepuis(String(meds.depuis || ""));

    const comps = asObj(q.complements);
    setSupplementsOui(comps.prend_complements ? "نعم" : "لا");
    setSupplements(asArr(comps.liste));
    setEvenements(asArr(q.evenements_precedents));

    const soins = asObj(q.soins_cheveux);
    setLavage(String(soins.frequence_lavage || WASH_FREQUENCY[1]));
    setProduitsUtilises(asArr(soins.produits));
    setChaleurEau(String(soins.chaleur_eau || WATER_TEMP[1]));
    setFacteurs(asArr(q.facteurs));

    const nutrition = asObj(q.nutrition);
    setProteine(String(nutrition.proteine || PROTEIN_INTAKE[1]));
    setFruits(String(nutrition.fruits_legumes || FRUIT_VEG[1]));
    setEauLitres(String(nutrition.eau_litres ?? "1.5"));
    setPorosite(String(q.porosite || POROSITY[3]));

    const labs = asObj(q.analyses_medicales);
    setLabos(asArr(labs.disponibles));
    const vals = asObj(labs.valeurs);
    const mapped: Record<string, string> = {};
    Object.entries(vals).forEach(([k, v]) => {
      mapped[k] = String(v ?? "");
    });
    setLabValues(mapped);
  }, [initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneIssue = validatePhonePair(phone, phoneConfirm);
    if (phoneIssue) {
      setPhoneError(phoneIssue);
      return;
    }
    setPhoneError("");
    const questionnaire = {
      raisons_contact: raisons.includes("أخرى") && raisonAutre ? [...raisons.filter((r) => r !== "أخرى"), `أخرى: ${raisonAutre}`] : raisons,
      description_probleme: {
        depuis_quand: depuisQuand,
        comment_commence: commentCommence,
        severite,
      },
      lieu_probleme: lieux,
      nature_cheveux: {
        type_cheveux: typeCheveux,
        densite,
        longueur,
      },
      nature_frove: {
        type_frove: typeFrove,
        problemes: problemesFrove,
      },
      historique_sante: historique,
      medicaments: {
        prend_medicaments: medicamentsOui === "نعم",
        nom: medicamentNom,
        depuis: medicamentDepuis,
      },
      complements: {
        prend_complements: supplementsOui === "نعم",
        liste: supplements,
      },
      evenements_precedents: evenements,
      soins_cheveux: {
        frequence_lavage: lavage,
        produits: produitsUtilises,
        chaleur_eau: chaleurEau,
      },
      facteurs: facteurs,
      nutrition: {
        proteine,
        fruits_legumes: fruits,
        eau_litres: Number(eauLitres) || 0,
      },
      porosite,
      analyses_medicales: {
        disponibles: labos,
        valeurs: labValues,
      },
    };

    onSubmit({
      advisor_name: advisorName,
      full_name: fullName,
      birth_date: birthDate,
      gender,
      city,
      phone,
      notes,
      questionnaire,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Section title="المستشارة">
        <label className="label">اسم المستشارة *</label>
        <select className="input" required value={advisorName} onChange={(e) => setAdvisorName(e.target.value)}>
          <option value="">اختاري اسمك…</option>
          {advisorNames.map((a) => (
            <option key={a.id} value={a.name}>
              {a.advisor_code ? `${a.advisor_code} — ${a.name}` : a.name}
            </option>
          ))}
        </select>
      </Section>

      <Section title="1. المعلومات الشخصية">
        <div>
          <label className="label">الاسم الكامل *</label>
          <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">تاريخ الازدياد *</label>
            <input className="input" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <label className="label">الجنس *</label>
            <RadioGroup name="gender" options={["ذكر", "أنثى"]} value={gender} onChange={setGender} />
          </div>
        </div>
        <div>
          <label className="label">المدينة *</label>
          <input className="input" list="cities" required value={city} onChange={(e) => setCity(e.target.value)} />
          <datalist id="cities">
            {CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">رقم الهاتف * (يبدأ بـ 0 — 10 أرقام)</label>
            <input
              className="input"
              required
              dir="ltr"
              inputMode="numeric"
              pattern="0[0-9]{9}"
              maxLength={10}
              placeholder="0612345678"
              value={phone}
              onChange={(e) => {
                setPhone(digitsOnly(e.target.value));
                setPhoneError("");
              }}
            />
          </div>
          <div>
            <label className="label">تأكيد رقم الهاتف *</label>
            <input
              className="input"
              required
              dir="ltr"
              inputMode="numeric"
              pattern="0[0-9]{9}"
              maxLength={10}
              placeholder="أعيدي إدخال الرقم"
              value={phoneConfirm}
              onChange={(e) => {
                setPhoneConfirm(digitsOnly(e.target.value));
                setPhoneError("");
              }}
            />
          </div>
        </div>
        {phoneError ? <p className="text-sm text-[var(--danger)]">{phoneError}</p> : null}
      </Section>

      <Section title="2. سبب التواصل">
        <CheckGroup options={CONTACT_REASONS} values={raisons} onChange={setRaisons} />
        {raisons.includes("أخرى") ? (
          <input className="input" placeholder="حددي السبب الآخر" value={raisonAutre} onChange={(e) => setRaisonAutre(e.target.value)} />
        ) : null}
      </Section>

      <Section title="3. وصف المشكلة">
        <div>
          <label className="label">منذ متى بدأت المشكلة؟</label>
          <select className="input" value={depuisQuand} onChange={(e) => setDepuisQuand(e.target.value)}>
            {PROBLEM_DURATION.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">كيف بدأت؟</label>
          <RadioGroup name="start" options={PROBLEM_START} value={commentCommence} onChange={setCommentCommence} />
        </div>
        <div>
          <label className="label">شدة المشكلة (1–10): {severite}</label>
          <input
            className="w-full"
            type="range"
            min={1}
            max={10}
            value={severite}
            onChange={(e) => setSeverite(Number(e.target.value))}
          />
        </div>
      </Section>

      <Section title="4. مكان المشكلة">
        <CheckGroup options={PROBLEM_LOCATIONS} values={lieux} onChange={setLieux} />
      </Section>

      <Section title="5. طبيعة الشعر">
        <label className="label">نوع الشعر</label>
        <RadioGroup name="hairType" options={HAIR_TYPES} value={typeCheveux} onChange={setTypeCheveux} />
        <label className="label">كثافة الشعر</label>
        <RadioGroup name="density" options={HAIR_DENSITY} value={densite} onChange={setDensite} />
        <label className="label">طول الشعر</label>
        <RadioGroup name="length" options={HAIR_LENGTH} value={longueur} onChange={setLongueur} />
      </Section>

      <Section title="6. طبيعة فروة الرأس">
        <label className="label">نوع الفروة</label>
        <RadioGroup name="scalp" options={SCALP_TYPES} value={typeFrove} onChange={setTypeFrove} />
        <label className="label">مشاكل الفروة</label>
        <CheckGroup options={SCALP_ISSUES} values={problemesFrove} onChange={setProblemesFrove} />
      </Section>

      <Section title="7. التاريخ الصحي">
        <CheckGroup options={HEALTH_HISTORY} values={historique} onChange={setHistorique} />
      </Section>

      <Section title="8. الأدوية">
        <RadioGroup name="meds" options={["نعم", "لا"]} value={medicamentsOui} onChange={setMedicamentsOui} />
        {medicamentsOui === "نعم" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="اسم الدواء" value={medicamentNom} onChange={(e) => setMedicamentNom(e.target.value)} />
            <input className="input" placeholder="منذ متى؟" value={medicamentDepuis} onChange={(e) => setMedicamentDepuis(e.target.value)} />
          </div>
        ) : null}
      </Section>

      <Section title="9. المكملات الغذائية">
        <RadioGroup name="supps" options={["نعم", "لا"]} value={supplementsOui} onChange={setSupplementsOui} />
        {supplementsOui === "نعم" ? (
          <CheckGroup options={SUPPLEMENTS} values={supplements} onChange={setSupplements} />
        ) : null}
      </Section>

      <Section title="10. الأحداث التي سبقت ظهور المشكلة">
        <CheckGroup options={PRECEDING_EVENTS} values={evenements} onChange={setEvenements} />
      </Section>

      <Section title="11. العناية بالشعر">
        <label className="label">عدد مرات غسل الشعر</label>
        <RadioGroup name="wash" options={WASH_FREQUENCY} value={lavage} onChange={setLavage} />
        <label className="label">المنتجات المستعملة</label>
        <CheckGroup options={USED_PRODUCTS} values={produitsUtilises} onChange={setProduitsUtilises} />
        <label className="label">حرارة الماء</label>
        <RadioGroup name="temp" options={WATER_TEMP} value={chaleurEau} onChange={setChaleurEau} />
      </Section>

      <Section title="12. العوامل المؤثرة">
        <CheckGroup options={INFLUENCING_FACTORS} values={facteurs} onChange={setFacteurs} />
      </Section>

      <Section title="13. التغذية">
        <label className="label">استهلاك البروتين</label>
        <RadioGroup name="protein" options={PROTEIN_INTAKE} value={proteine} onChange={setProteine} />
        <label className="label">تناول الخضر والفواكه</label>
        <RadioGroup name="fruits" options={FRUIT_VEG} value={fruits} onChange={setFruits} />
        <label className="label">كمية الماء يومياً (لتر)</label>
        <input className="input" type="number" step="0.1" value={eauLitres} onChange={(e) => setEauLitres(e.target.value)} />
      </Section>

      <Section title="14. مسامية الشعر">
        <RadioGroup name="porosity" options={POROSITY} value={porosite} onChange={setPorosite} />
      </Section>

      <Section title="⭐ التحاليل الطبية">
        <CheckGroup
          options={MEDICAL_LABS}
          values={labos}
          onChange={(next) => {
            setLabos(next);
            if (next.includes("لا توجد تحاليل")) {
              setLabos(["لا توجد تحاليل"]);
            }
          }}
        />
        {labos.filter((l) => l !== "لا توجد تحاليل").map((lab) => (
          <div key={lab}>
            <label className="label">نتيجة {lab}</label>
            <input
              className="input"
              value={labValues[lab] || ""}
              onChange={(e) => setLabValues((prev) => ({ ...prev, [lab]: e.target.value }))}
            />
          </div>
        ))}
      </Section>

      <Section title="20. ملاحظات داخلية">
        <textarea className="input min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Section>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "جاري الحفظ…" : submitLabel || "حفظ الاستمارة وتوليد المعرف"}
        </button>
        {onCancel ? (
          <button className="btn-secondary" type="button" onClick={onCancel} disabled={submitting}>
            إلغاء
          </button>
        ) : null}
      </div>
    </form>
  );
}
