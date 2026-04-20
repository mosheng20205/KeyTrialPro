import type { TrendPoint } from "../types";

type TrendBarsProps = {
  title: string;
  points: TrendPoint[];
  mode: "active" | "activated" | "trial";
};

function valueFor(point: TrendPoint, mode: TrendBarsProps["mode"]): number {
  if (mode === "active") return point.daily_active_count;
  if (mode === "trial") return point.daily_trial_started_count;
  return point.daily_new_activated_count;
}

export function TrendBars({ title, points, mode }: TrendBarsProps) {
  const max = Math.max(...points.map((point) => valueFor(point, mode)), 1);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Daily Trend</p>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="trend-bars">
        {points.map((point) => {
          const value = valueFor(point, mode);
          return (
            <div className="trend-column" key={`${mode}-${point.date}`}>
              <div className="trend-meter">
                <div className="trend-fill" style={{ height: `${(value / max) * 100}%` }} />
              </div>
              <span className="trend-value">{value}</span>
              <span className="trend-label">{point.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

