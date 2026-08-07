export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="panel p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="kpi-value mt-2">{value}</p>
      {hint ? (
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
