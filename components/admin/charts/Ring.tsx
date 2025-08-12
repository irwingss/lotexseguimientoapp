"use client"

import React from 'react'

type RingProps = {
  label: string
  percent: number // 0-100
  size?: number // px
  stroke?: number // px
  colorClass?: string // tailwind color class for stroke
}

export function Ring({ label, percent, size = 96, stroke = 8, colorClass = 'stroke-primary' }: RingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  const dash = (clamped / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <svg width={size} height={size} className="block">
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          {/* track */}
          <circle r={radius} className="stroke-muted" strokeWidth={stroke} fill="none" />
          {/* progress */}
          <circle
            r={radius}
            className={`${colorClass} transition-all duration-500 ease-out`}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90)"
          />
        </g>
      </svg>
      <div className="mt-2 text-center">
        <div className="text-xl font-semibold tabular-nums">{Math.round(clamped)}%</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
