export const CITIES = [
  "الدار البيضاء",
  "الرباط",
  "مراكش",
  "فاس",
  "طنجة",
  "أكادير",
  "مكناس",
  "وجدة",
  "القنيطرة",
  "تطوان",
];

export const CONTACT_REASONS = [
  "تساقط الشعر",
  "فراغات في الشعر",
  "ضعف وترقق الشعر",
  "بطء نمو الشعر",
  "تكسر الشعر",
  "قشرة",
  "حكة",
  "دهون زائدة",
  "أخرى",
];

export const PROBLEM_DURATION = [
  "أقل من شهر",
  "من شهر إلى 3 أشهر",
  "من 3 إلى 6 أشهر",
  "من 6 أشهر إلى سنة",
  "أكثر من سنة",
];

export const PROBLEM_START = ["فجأة", "تدريجياً"];

export const PROBLEM_LOCATIONS = [
  "كامل الرأس",
  "مقدمة الرأس",
  "منتصف الرأس",
  "جانبا الرأس",
  "مؤخرة الرأس",
  "اللحية",
  "الحواجب",
  "أماكن أخرى",
];

export const HAIR_TYPES = ["مستقيم", "متموج", "مجعد", "شديد التجعد"];
export const HAIR_DENSITY = ["كثيف", "متوسط", "خفيف"];
export const HAIR_LENGTH = ["قصير", "متوسط", "طويل"];

export const SCALP_TYPES = ["طبيعية", "دهنية", "جافة", "مختلطة", "حساسة"];
export const SCALP_ISSUES = [
  "قشرة دهنية",
  "قشرة جافة",
  "احمرار",
  "حكة",
  "ألم",
  "التهاب البصيلات",
  "دهون زائدة",
  "جفاف",
];

export const HEALTH_HISTORY = [
  "اضطرابات الغدة الدرقية",
  "فقر الدم",
  "نقص الحديد",
  "نقص فيتامين D",
  "نقص فيتامين B12",
  "السكري",
  "تكيس المبايض",
  "أمراض مناعية",
  "مشاكل الجهاز الهضمي",
  "أمراض الكبد",
  "الحمل",
  "الرضاعة",
  "أخرى",
];

export const SUPPLEMENTS = [
  "الحديد",
  "الزنك",
  "فيتامين D",
  "البيوتين",
  "أوميغا 3",
  "الكولاجين",
  "المغنيسيوم",
  "أخرى",
];

export const PRECEDING_EVENTS = [
  "ضغط نفسي",
  "ولادة",
  "عملية جراحية",
  "كوفيد",
  "حمية غذائية",
  "فقدان وزن",
  "تخدير",
  "تغيرات هرمونية",
  "علاج كيماوي",
  "وراثة",
  "لا يوجد",
];

export const WASH_FREQUENCY = [
  "يومياً",
  "كل يومين",
  "كل 3 أيام",
  "مرة أسبوعياً",
  "أقل من مرة أسبوعياً",
];

export const USED_PRODUCTS = [
  "شامبو",
  "بلسم",
  "ماسك",
  "زيوت",
  "سيروم",
  "سبراي",
  "حناء",
  "صبغة",
  "سحب لون",
  "بروتين",
  "بوتوكس",
  "أخرى",
];

export const WATER_TEMP = ["بارد", "فاتر", "ساخن"];

export const INFLUENCING_FACTORS = [
  "التعرض للشمس",
  "التوتر",
  "قلة النوم",
  "سوء التغذية",
  "التدخين",
  "تلوث الهواء",
  "ربط الشعر بقوة",
  "ارتداء الخوذة لفترات طويلة",
  "أخرى",
];

export const PROTEIN_INTAKE = ["ضعيف", "متوسط", "جيد"];
export const FRUIT_VEG = ["نادراً", "أحياناً", "يومياً"];
export const POROSITY = ["منخفضة", "متوسطة", "مرتفعة", "غير معروفة"];

export const MEDICAL_LABS = [
  "Ferritine",
  "Fer",
  "Vitamine D",
  "Vitamine B12",
  "Zinc",
  "TSH",
  "T3",
  "T4",
  "NFS",
  "Glycémie",
  "Hormones",
  "لا توجد تحاليل",
];

export const CATALOG_PRODUCTS = ["Grow", "لبانة", "Dermaroller", "Ketoderm"];

export const CUSTOMER_STATUSES = [
  { value: "nouvelle", label: "جديدة" },
  { value: "formulaire_rempli", label: "تم ملء الاستمارة" },
  { value: "analyse_effectuee", label: "تم إجراء التحليل" },
  { value: "programme_envoye", label: "تم إرسال البرنامج" },
  { value: "produits_proposes", label: "تم اقتراح المنتجات" },
  { value: "a_commande", label: "قامت بالطلب" },
  { value: "en_suivi", label: "قيد المتابعة" },
  { value: "suivi_termine", label: "انتهت المتابعة" },
];

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
