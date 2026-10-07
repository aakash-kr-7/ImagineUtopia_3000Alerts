import React from "react";
export function Stat({
  label,
  value,
  subtitle,
  icon,
  spark,
  unit,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  spark: string;
  unit?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {label}
        <span className={"stat-icon " + spark}>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="stat-subtitle">{subtitle}</div>
    </div>
  );
}
