"use client";

import { useId, useMemo, useState, type PointerEvent } from "react";

import { monthDayLabel, parseDay } from "@/lib/dates";
import { money } from "@/lib/format";

export type ChartPoint = { date: string; value: number };

export type ChartSeries = {
  id: string;
  name: string;
  color: string;
  dash?: boolean;
  width?: number;
  points: ChartPoint[];
};

type CashChartProps = {
  series: ChartSeries[];
  band?: { name: string; color: string; low: ChartPoint[]; high: ChartPoint[] };
  marker?: { date: string; label: string } | null;
  ariaLabel: string;
  compact?: boolean;
};

const PAD = { l: 56, r: 18, t: 22, b: 32 };

function compactMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const thousands = abs / 1000;
    const digits = thousands >= 10 ? 0 : 1;
    return `${sign}$${thousands.toFixed(digits)}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

function niceStep(span: number): number {
  const rough = span / 4 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(Math.abs(rough)));
  const error = rough / magnitude;
  if (error >= 7.5) return 10 * magnitude;
  if (error >= 3.5) return 5 * magnitude;
  if (error >= 1.5) return 2 * magnitude;
  return magnitude;
}

function smooth(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(index - 1, 0)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(index + 2, points.length - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function sampleIndexes(count: number, dots: number): number[] {
  if (count <= dots) return Array.from({ length: count }, (_, index) => index);
  const indexes = new Set<number>([0, count - 1]);
  for (let step = 1; step < dots - 1; step += 1) {
    indexes.add(Math.round((step * (count - 1)) / (dots - 1)));
  }
  return [...indexes].sort((a, b) => a - b);
}

export function CashChart({ series, band, marker, ariaLabel, compact = false }: CashChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<string | null>(null);
  const width = compact ? 640 : 920;
  const height = compact ? 230 : 420;
  const signature = series.map((line) => `${line.id}:${line.points.at(-1)?.value ?? 0}:${line.points.length}`).join("|");

  const model = useMemo(() => {
    const dates = new Set<string>();
    for (const line of series) for (const point of line.points) dates.add(point.date);
    if (band) {
      for (const point of band.low) dates.add(point.date);
      for (const point of band.high) dates.add(point.date);
    }
    const axis = [...dates].sort();
    const values = series.flatMap((line) => line.points.map((point) => point.value));
    if (band) values.push(...band.low.map((point) => point.value), ...band.high.map((point) => point.value));
    let yMin = Math.min(...values);
    let yMax = Math.max(...values);
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = 0;
      yMax = 1;
    }
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
    const pad = (yMax - yMin) * 0.12;
    yMin -= pad;
    yMax += pad;
    const x0 = parseDay(axis[0] ?? "2026-01-01");
    const x1 = parseDay(axis[axis.length - 1] ?? "2026-01-02");
    const plotW = width - PAD.l - PAD.r;
    const plotH = height - PAD.t - PAD.b;
    const xOf = (date: string) => PAD.l + ((parseDay(date) - x0) / Math.max(x1 - x0, 1)) * plotW;
    const yOf = (value: number) => PAD.t + ((yMax - value) / (yMax - yMin)) * plotH;
    const step = niceStep(yMax - yMin);
    const ticks: number[] = [];
    for (let tick = Math.ceil(yMin / step) * step; tick <= yMax + step * 0.01; tick += step) {
      ticks.push(Number(tick.toFixed(6)));
    }
    const xLabels = compact
      ? axis.filter((_, index) => index === 0 || index === axis.length - 1 || index === Math.floor(axis.length / 2))
      : axis.filter((date, index) => date.endsWith("-01") || index === 0);
    const coords = (points: ChartPoint[]) => points.map((point) => ({ x: xOf(point.date), y: yOf(point.value), ...point }));
    return { axis, yMin, yMax, xOf, yOf, ticks, xLabels, coords };
  }, [series, band, compact, width, height]);

  const active =
    hover && model.axis.includes(hover)
      ? hover
      : marker?.date && model.axis.includes(marker.date)
        ? marker.date
        : model.axis[Math.min(model.axis.length - 1, Math.floor(model.axis.length * 0.35))] ?? model.axis[0];

  function move(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = width / rect.width;
    const x = (event.clientX - rect.left) * scale;
    let nearest = model.axis[0];
    let best = Number.POSITIVE_INFINITY;
    for (const date of model.axis) {
      const distance = Math.abs(model.xOf(date) - x);
      if (distance < best) {
        best = distance;
        nearest = date;
      }
    }
    setHover(nearest);
  }

  const primary = series.find((line) => !line.dash) ?? series[0];
  const primaryCoords = primary ? model.coords(primary.points) : [];
  const floor = height - PAD.b;
  const area = primaryCoords.length
    ? `${smooth(primaryCoords)} L ${primaryCoords[primaryCoords.length - 1].x.toFixed(1)} ${floor} L ${primaryCoords[0].x.toFixed(1)} ${floor} Z`
    : "";
  const zeroY = model.yMin < 0 && model.yMax > 0 ? model.yOf(0) : null;
  const dots = sampleIndexes(primaryCoords.length, compact ? 6 : 8);

  let bandPath = "";
  if (band && band.high.length > 1 && band.low.length === band.high.length) {
    const high = model.coords(band.high);
    const low = model.coords(band.low);
    bandPath = `${smooth(high)} L ${[...low].reverse().map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L ")} Z`;
  }

  return (
    <figure className={compact ? "chart compact" : "chart"}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary?.color ?? "#22d3ee"} stopOpacity="0.45" />
            <stop offset="70%" stopColor={primary?.color ?? "#22d3ee"} stopOpacity="0.08" />
            <stop offset="100%" stopColor={primary?.color ?? "#22d3ee"} stopOpacity="0" />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {model.ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.l} x2={width - PAD.r} y1={model.yOf(tick)} y2={model.yOf(tick)} className="grid" />
            <text x={PAD.l - 8} y={model.yOf(tick) + 4} className="tick" textAnchor="end">
              {compactMoney(tick)}
            </text>
          </g>
        ))}
        {model.xLabels.map((date) => (
          <text key={date} x={model.xOf(date)} y={height - 10} className="tick" textAnchor="middle">
            {monthDayLabel(date).replace(/, \d{4}$/, "")}
          </text>
        ))}
        {zeroY !== null ? <line x1={PAD.l} x2={width - PAD.r} y1={zeroY} y2={zeroY} className="zero" /> : null}
        <g key={signature}>
          {bandPath ? <path d={bandPath} fill={band?.color} className="band-path" /> : null}
          {area ? <path d={area} fill={`url(#${gradientId}-fill)`} className="area-path" /> : null}
          {series.map((line) => (
            <path
              key={line.id}
              d={smooth(model.coords(line.points))}
              className={line.dash ? "series-dashed" : "series-line"}
              fill="none"
              stroke={line.color}
              strokeWidth={line.width ?? (compact ? 2.4 : 2.8)}
              pathLength={line.dash ? undefined : 1}
              strokeDasharray={line.dash ? "6 5" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={line.dash ? undefined : `url(#${gradientId}-glow)`}
            />
          ))}
          {primaryCoords.length
            ? dots.map((index) => {
                const point = primaryCoords[index];
                const hot = point.date === active || point.date === marker?.date;
                return (
                  <g key={point.date} className="node">
                    <circle cx={point.x} cy={point.y} r={hot ? 9 : 6} fill={primary?.color} opacity={hot ? 0.35 : 0.22} className="node-halo" />
                    <circle cx={point.x} cy={point.y} r={hot ? 4.2 : 3.1} fill="#f8fbff" stroke={primary?.color} strokeWidth="2" />
                  </g>
                );
              })
            : null}
        </g>
        {active ? (
          <line x1={model.xOf(active)} x2={model.xOf(active)} y1={PAD.t} y2={height - PAD.b} className="hover-line" />
        ) : null}
      </svg>
      <div className="legend">
        {band ? (
          <span>
            <i className="swatch band" style={{ background: band.color }} />
            {band.name}
          </span>
        ) : null}
        {series.map((line) => (
          <span key={line.id}>
            <i className="swatch" style={{ background: line.color }} />
            {line.name}
          </span>
        ))}
      </div>
      <dl className="readout">
        <div>
          <dt>Date</dt>
          <dd>{active ? monthDayLabel(active) : "—"}</dd>
        </div>
        {series.map((line) => {
          const point = line.points.find((item) => item.date === active);
          return (
            <div key={line.id}>
              <dt>{line.name}</dt>
              <dd>{point ? money(point.value) : "—"}</dd>
            </div>
          );
        })}
      </dl>
    </figure>
  );
}
