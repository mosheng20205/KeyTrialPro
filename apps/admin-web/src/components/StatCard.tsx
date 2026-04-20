type StatCardProps = {
  label: string;
  value: string;
  tone?: "default" | "alert";
  hint: string;
};

export function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  return (
    <section className={`stat-card ${tone === "alert" ? "stat-card-alert" : ""}`}>
      <p className="eyebrow">{label}</p>
      <h3>{value}</h3>
      <p className="stat-hint">{hint}</p>
    </section>
  );
}

