"use client";

import * as React from "react";

type Segment = {
  label: string;
  value: number;
  color: string; // any valid CSS color
};

interface DonutChartProps {
  segments: Segment[];
  size?: number; // outer size in px
  thickness?: number; // stroke thickness
}

export function DonutChart({ segments, size = 160, thickness = 18 }: DonutChartProps) {
  const total = Math.max(
    segments.reduce((acc, s) => acc + (isFinite(s.value) ? s.value : 0), 0),
    0
  );
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="flex items-center gap-5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 text-muted-foreground"
      >
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
          {/* Track */}
          <circle
            r={radius}
            cx={0}
            cy={0}
            fill="transparent"
            className="text-muted-foreground/25"
            stroke="currentColor"
            strokeWidth={thickness}
          />
          {/* Segments */}
          {segments.map((seg, idx) => {
            const value = Math.max(seg.value, 0);
            const length = total > 0 ? (value / total) * circumference : 0;
            const dashArray = `${length} ${circumference - length}`;
            const dashOffset = -cumulative;
            cumulative += length;
            return (
              <circle
                key={idx}
                r={radius}
                cx={0}
                cy={0}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
              />
            );
          })}
        </g>
        {/* Center label */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-current text-[28px] font-semibold"
        >
          {total}
        </text>
      </svg>
      {/* Legend */}
      <div className="space-y-2">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div key={seg.label} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-muted-foreground">{seg.label}</span>
              <span className="ml-auto font-medium tabular-nums">
                {seg.value} ({pct}%)
              </span>
            </div>
          );
        })}
        {segments.length === 0 && (
          <p className="text-xs text-muted-foreground">Sin datos</p>
        )}
      </div>
    </div>
  );
}
