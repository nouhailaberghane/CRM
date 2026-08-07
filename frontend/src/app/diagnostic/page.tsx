"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, RefreshCcw, ShieldCheck, ArrowLeft, Ban } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";

type Step = "id" | "choose" | "camera" | "analyzing" | "result" | "already";

const ANALYSIS_STEPS = [
  "جاري تحليل صورة فروة الرأس...",
  "نقوم الآن بتحليل الصورة وتقييم المؤشرات المرتبطة بصحة بصيلات الشعر.",
  "لحظات قليلة، نتيجتك قيد التحضير ✨",
  "اكتمل التحليل ✓",
  "نتيجتك جاهزة",
] as const;

const STEP_MS = 1600;

export default function DiagnosticPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [step, setStep] = useState<Step>("id");
  const [customerCode, setCustomerCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [humidity, setHumidity] = useState<number | null>(null);
  const [measuredAt, setMeasuredAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [analysisStep, setAnalysisStep] = useState(0);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError("تعذّر الوصول إلى الكاميرا. يرجى السماح بالصلاحية ثم المحاولة مجدداً.");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (step === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      if (step === "camera") stopCamera();
    };
  }, [step, startCamera, stopCamera]);

  useEffect(() => {
    if (step !== "analyzing") return;
    setAnalysisStep(0);
    const timers: number[] = [];
    ANALYSIS_STEPS.forEach((_, index) => {
      if (index === 0) return;
      timers.push(
        window.setTimeout(() => {
          setAnalysisStep(index);
        }, index * STEP_MS)
      );
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [step]);

  const resetToId = () => {
    setHumidity(null);
    setMeasuredAt(null);
    setCustomerCode("");
    setFirstName("");
    setError("");
    setAnalysisStep(0);
    setStep("id");
  };

  const runAnalysisFlow = async (blob: Blob, filename = "hair-scan.jpg") => {
    stopCamera();
    setStep("analyzing");
    setAnalysisStep(0);
    setError("");

    const form = new FormData();
    form.append("customer_code", customerCode);
    form.append("image", blob, filename);

    const animationDone = new Promise<void>((resolve) => {
      window.setTimeout(resolve, ANALYSIS_STEPS.length * STEP_MS);
    });

    const [{ data }] = await Promise.all([
      api.post("/diagnostic/analyze", form, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
      animationDone,
    ]);

    setHumidity(data.humidity);
    setMeasuredAt(data.measured_at || null);
    setStep("result");
  };

  const lookup = async () => {
    setError("");
    setLoading(true);
    try {
      const code = customerCode.trim().toUpperCase();
      const { data } = await api.get(`/diagnostic/lookup/${code}`);
      setCustomerCode(data.customer_code);
      setFirstName(data.first_name);

      if (data.diagnostic_done) {
        setHumidity(data.humidity ?? null);
        setMeasuredAt(data.humidity_measured_at || null);
        setStep("already");
        return;
      }

      setStep("choose");
    } catch (err) {
      setError(getErrorMessage(err, "المعرّف غير موجود"));
    } finally {
      setLoading(false);
    }
  };

  const captureAndAnalyze = async () => {
    setError("");
    setLoading(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error("الكاميرا غير جاهزة");

      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 960;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("تعذّر التقاط الصورة");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (!blob) throw new Error("تعذّر التقاط الصورة");

      await runAnalysisFlow(blob);
    } catch (err) {
      setError(getErrorMessage(err, "فشل التحليل"));
      setStep("camera");
    } finally {
      setLoading(false);
    }
  };

  const onGallerySelected = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("يرجى اختيار صورة.");
      return;
    }
    setLoading(true);
    try {
      await runAnalysisFlow(file, file.name || "gallery.jpg");
    } catch (err) {
      setError(getErrorMessage(err, "فشل التحليل"));
      setStep("choose");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const screenshot = async () => {
    if (!resultRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(resultRef.current, { backgroundColor: "#f4f7f5" });
      const link = document.createElement("a");
      link.download = `${customerCode}-follicle-health.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      window.print();
    }
  };

  const backToChoose = () => {
    setError("");
    stopCamera();
    setStep("choose");
  };

  const formatDateAr = (value?: string | null) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("ar-MA");
    } catch {
      return value;
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 md:px-6">
      <div
        className="mx-auto max-w-md overflow-hidden rounded-[28px] border shadow-soft"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
      >
        <div className="px-6 pb-4 pt-7" style={{ background: "linear-gradient(160deg, var(--primary-soft), transparent)" }}>
          <p className="display text-3xl leading-tight text-[var(--primary)]">
            {APP_NAME}
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            مؤشر صحة البصيلات — مرة واحدة فقط لكل عميلة. الصورة لا تُحفظ أبداً.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {step === "id" ? (
            <>
              <div>
                <label className="label">معرّف العميلة</label>
                <input
                  className="input uppercase tracking-wider"
                  placeholder="المعرّف المستلم"
                  dir="ltr"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                />
              </div>
              <button className="btn-primary w-full" onClick={lookup} disabled={loading || !customerCode.trim()}>
                {loading ? "جاري التحقق…" : "متابعة"}
              </button>
            </>
          ) : null}

          {step === "already" ? (
            <div className="space-y-4 rounded-2xl p-4 text-center" style={{ background: "var(--bg)" }}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                <Ban size={22} />
              </div>
              <div>
                <p className="text-lg font-semibold">تم إجراء التشخيص مسبقاً</p>
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  مرحباً {firstName}. يُسمح بتحليل واحد فقط. نتيجتك مسجّلة مسبقاً على ملفك.
                </p>
              </div>
              {humidity != null ? (
                <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm" style={{ color: "var(--muted)" }} dir="ltr">
                    {customerCode}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    مؤشر صحة البصيلات
                  </p>
                  <p className="display mt-2 text-5xl text-[var(--primary)]">{humidity}%</p>
                  {measuredAt ? (
                    <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                      التاريخ: {formatDateAr(measuredAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <button className="btn-secondary w-full" onClick={resetToId}>
                رجوع
              </button>
            </div>
          ) : null}

          {step === "choose" ? (
            <>
              <div className="rounded-2xl p-3 text-sm" style={{ background: "var(--primary-soft)" }}>
                مرحباً {firstName}. اختاري طريقة إرسال صورة فروة الرأس.
                <span className="mt-1 block text-xs opacity-80">يمكن إجراء هذا التشخيص مرة واحدة فقط.</span>
              </div>
              <button
                className="btn-primary flex w-full items-center justify-center gap-2 py-4"
                onClick={() => {
                  setError("");
                  setStep("camera");
                }}
                disabled={loading}
              >
                <Camera size={20} />
                التقاط صورة
              </button>
              <button
                className="btn-secondary flex w-full items-center justify-center gap-2 py-4"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <ImageIcon size={20} />
                اختيار من المعرض
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onGallerySelected(e.target.files?.[0])}
              />
            </>
          ) : null}

          {step === "camera" ? (
            <>
              <div className="rounded-2xl p-3 text-sm" style={{ background: "var(--primary-soft)" }}>
                ضعي فروة الرأس في وسط الإطار ثم التقطي الصورة.
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-black">
                <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
                <div className="pointer-events-none absolute inset-8 rounded-full border border-white/50" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
                >
                  <RefreshCcw size={16} />
                  قلب الكاميرا
                </button>
                <button className="btn-primary" onClick={captureAndAnalyze} disabled={loading}>
                  <Camera size={16} />
                  التقاط
                </button>
              </div>
              <button className="btn-secondary w-full" onClick={backToChoose} disabled={loading}>
                <ArrowLeft size={16} />
                خيار آخر
              </button>
            </>
          ) : null}

          {step === "analyzing" ? (
            <div className="space-y-5 rounded-2xl p-5 text-center" style={{ background: "var(--bg)" }}>
              <div
                className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-[var(--primary-soft)] border-t-[var(--primary)]"
                aria-hidden
              />
              <div className="min-h-[5.5rem]">
                <p
                  key={analysisStep}
                  className="text-base font-medium leading-7 text-[var(--primary)] transition-opacity duration-500"
                >
                  {ANALYSIS_STEPS[analysisStep]}
                </p>
              </div>
              <div className="flex justify-center gap-1.5">
                {ANALYSIS_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-6 rounded-full transition-colors"
                    style={{
                      background: i <= analysisStep ? "var(--primary)" : "var(--border)",
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {step === "result" && humidity != null ? (
            <div ref={resultRef} className="space-y-4 rounded-2xl p-4" style={{ background: "var(--bg)" }}>
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--primary)]">
                <ShieldCheck size={18} />
                تم حفظ النتيجة على ملفك — الصورة لم تُحفظ
              </div>
              <div className="text-center">
                <p className="text-sm" style={{ color: "var(--muted)" }} dir="ltr">
                  {customerCode}
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--muted)" }}>
                  مؤشر صحة البصيلات
                </p>
                <p className="display mt-2 text-6xl text-[var(--primary)]">{humidity}%</p>
                <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                  يُحفظ مع بياناتك: النسبة · التاريخ · إصدار الخوارزمية — مرة واحدة فقط
                </p>
              </div>
              <button className="btn-primary w-full" onClick={screenshot}>
                حفظ النتيجة كصورة
              </button>
              <button className="btn-secondary w-full" onClick={resetToId}>
                إنهاء
              </button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
