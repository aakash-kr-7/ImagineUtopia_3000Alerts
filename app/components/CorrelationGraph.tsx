import { Check, Network } from "lucide-react";
import { useState } from "react";
import type { AlertGroup, Edge } from "../../core/contracts";
export function CorrelationGraph({ detail }: { detail: any }) {
  const groups: AlertGroup[] = detail.groups.slice(0, 16),
    edges: Edge[] = detail.edges.filter(
      (e: Edge) =>
        groups.some((g) => g.id === e.from) &&
        groups.some((g) => g.id === e.to),
    ),
    [selected, setSelected] = useState<Edge | null>(edges[0] ?? null);
  const positions = Object.fromEntries(
    groups.map((g, i) => [
      g.id,
      {
        x:
          250 + 185 * Math.cos((i / groups.length) * Math.PI * 2 - Math.PI / 2),
        y:
          205 + 135 * Math.sin((i / groups.length) * Math.PI * 2 - Math.PI / 2),
      },
    ]),
  );
  return (
    <>
      <div className="inline-note">
        <Network size={15} />
        Each circle is a set of near-duplicate alerts. A line means two sets
        shared enough user, device, or network evidence to join this incident.
        Select a line to see why it passed.
      </div>
      <div className="graph-container">
        <svg
          viewBox="0 0 500 410"
          role="img"
          aria-label={`Correlation graph with ${groups.length} visible alert groups and ${edges.length} links.`}
        >
          {edges.map((e, i) => (
            <g
              key={i}
              onClick={() => setSelected(e)}
              role="button"
              tabIndex={0}
              aria-label={`Inspect link ${e.from} to ${e.to}`}
              onKeyDown={(k) => {
                if (k.key === "Enter" || k.key === " ") {
                  k.preventDefault();
                  setSelected(e);
                }
              }}
            >
              <line
                x1={positions[e.from].x}
                y1={positions[e.from].y}
                x2={positions[e.to].x}
                y2={positions[e.to].y}
                stroke={selected === e ? "#64e0bb" : "#405771"}
                strokeWidth={selected === e ? 2.5 : 1}
              />
              <line
                x1={positions[e.from].x}
                y1={positions[e.from].y}
                x2={positions[e.to].x}
                y2={positions[e.to].y}
                stroke="transparent"
                strokeWidth="15"
              />
            </g>
          ))}
          {groups.map((g, i) => (
            <g key={g.id}>
              <circle
                cx={positions[g.id].x}
                cy={positions[g.id].y}
                r="23"
                fill="#152237"
                stroke="#64e0bb"
                strokeWidth="1.5"
              />
              <text
                x={positions[g.id].x}
                y={positions[g.id].y + 4}
                textAnchor="middle"
                fill="#c8f7e9"
                fontSize="12"
                fontFamily="monospace"
              >
                G{i + 1}
              </text>
              <text
                x={positions[g.id].x}
                y={positions[g.id].y + 39}
                textAnchor="middle"
                fill="#a7b4c7"
                fontSize="11"
              >
                {g.type.replaceAll("_", " ").slice(0, 23)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {detail.groups.length > 16 && (
        <div className="inline-note">
          Showing 16 of {detail.groups.length} groups. All link reasons remain
          available below.
        </div>
      )}
      {selected ? (
        <div className="edge-card">
          <div className="section-title">
            <span>Why these alert groups were linked</span>
            <span className="verified">
              <Check size={13} />
              Threshold passed
            </span>
          </div>
          <div className="mono muted small-text">
            {selected.from} ↔ {selected.to}
          </div>
          <div className="edge-score">
            <strong>{selected.weight.toFixed(4)}</strong>
            <span>link score / minimum {selected.threshold.toFixed(2)}</span>
          </div>
          {selected.reasons.map((r, i) => (
            <div className="edge-reason" key={i}>
              <strong className="mono">{r.entity}</strong>
              <div>
                <span>
                  Time gap <b>{Math.round(r.gap_seconds)} seconds</b>
                </span>
                <span>
                  Rarity <b>{r.idf.toFixed(3)}</b>
                </span>
                <span>
                  Link contribution <b>{r.weight.toFixed(4)}</b>
                </span>
              </div>
            </div>
          ))}
          <details className="graph-formula">
            <summary>How the link score is calculated</summary>
            <p>
              A shared user or device adds more support than a common network
              address. Links count less as the time gap grows. A line appears
              only when the combined evidence reaches the minimum score.
            </p>
            <code>link support = entity importance × time decay</code>
          </details>
        </div>
      ) : (
        <div className="empty">
          <Network size={25} />
          <strong>Single group · no correlation links</strong>
          <span>This item is retained as a standalone investigation.</span>
        </div>
      )}
      <div className="detail-section">
        <div className="section-title">
          <span>All accepted links</span>
          <span>{detail.edges.length}</span>
        </div>
        {detail.edges.slice(0, 100).map((e: Edge, i: number) => (
          <button key={i} className="link-row" onClick={() => setSelected(e)}>
            <div className="mono">
              {e.from} ↔ {e.to}
              <small>{e.reasons.map((r) => r.entity).join(" · ")}</small>
            </div>
            <strong>{e.weight.toFixed(3)}</strong>
          </button>
        ))}
      </div>
    </>
  );
}
