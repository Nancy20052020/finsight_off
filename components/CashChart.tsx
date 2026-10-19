"use client";

import { useMemo, useState, type PointerEvent } from "react";

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
};

const WIDTH = 860;
const HEIGHT = 420;
const PAD = { l: 64, r: 16, t: 18, b: 36 };

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
  const rough = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const error = rough / magnitude;
  if (error >= 7.5) return 10 * magnitude;
  if (error >= 3.5) return 5 * magnitude;
  if (error >= 1.5) return 2 * magnitude;
  return magnitude;
}

export function CashChart({ series, band, marker, ariaLabel }: CashChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const model = useMemo(() => {
    const dates = new Set<string>();
    for (const line of series) for (const point of line.points) dates.add(point.date);
    if (band) {
      for (const point of band.low) dates.add(point.date);
      for (const point of band.high) dates.add(point.date);
    }
    const axis = [...dates].sort();
    const values = series.flatMap((line) => line.points.map((point) => point.value));
    if (band) {
      values.push(...band.low.map((point) => point.value), ...band.high.map((point) => point.value));
    }
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
    const pad = (yMax - yMin) * 0.08;
    yMin -= pad;
    yMax += pad;
    const x0 = parseDay(axis[0]);
    const x1 = parseDay(axis[axis.length - 1]);
    const plotW = WIDTH - PAD.l - PAD.r;
    const plotH = HEIGHT - PAD.t - PAD.b;
    const xOf = (date: string) => PAD.l + ((parseDay(date) - x0) / Math.max(x1 - x0, 1)) * plotW;
    const yOf = (value: number) => PAD.t + ((yMax - value) / (yMax - yMin)) * plotH;
    const step = niceStep(yMax - yMin);
    const ticks: number[] = [];
    for (let tick = Math.ceil(yMin / step) * step; tick <= yMax + step * 0.01; tick += step) {
      ticks.push(Number(tick.toFixed(6)));
    }
    const xLabels = axis.filter((date, index) => date.endsWith("-01") || index === 0);
    return { axis, yMin, yMax, xOf, yOf, ticks, xLabels };
  }, [series, band]);

  const active = hover && model.axis.includes(hover) ? hover : marker?.date && model.axis.includes(marker.date) ? marker.date : model.axis[model.axis.length - 1];

  function move(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = WIDTH / rect.width;
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

  function pathFor(points: ChartPoint[]): string {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"}${model.xOf(point.date).toFixed(1)},${model.yOf(point.value).toFixed(1)}`)
      .join(" ");
  }

  let bandPath = "";
  if (band && band.high.length > 1 && band.low.length === band.high.length) {
    const forward = band.high
      .map((point, index) => `${index === 0 ? "M" : "L"}${model.xOf(point.date).toFixed(1)},${model.yOf(point.value).toFixed(1)}`)
      .join(" ");
    const back = [...band.low]
      .reverse()
      .map((point) => `L${model.xOf(point.date).toFixed(1)},${model.yOf(point.value).toFixed(1)}`)
      .join(" ");
    bandPath = `${forward} ${back} Z`;
  }

  const zeroY = model.yMin < 0 && model.yMax > 0 ? model.yOf(0) : null;

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
      >
        {model.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.l}
              x2={WIDTH - PAD.r}
              y1={model.yOf(tick)}
              y2={model.yOf(tick)}
              className="grid"
            />
            <text x={PAD.l - 8} y={model.yOf(tick) + 4} className="tick" textAnchor="end">
              {compactMoney(tick)}
            </text>
          </g>
        ))}
        {model.xLabels.map((date) => (
          <text key={date} x={model.xOf(date)} y={HEIGHT - 12} className="tick" textAnchor="middle">
            {monthDayLabel(date).replace(/, \d{4}$/, "")}
          </text>
        ))}
        {zeroY !== null ? (
          <line x1={PAD.l} x2={WIDTH - PAD.r} y1={zeroY} y2={zeroY} className="zero" />
        ) : null}
        {bandPath ? <path d={bandPath} fill={band?.color} className="band-path" /> : null}
        {series.map((line) => (
          <path
            key={line.id}
            d={pathFor(line.points)}
            className={line.dash ? "series-dashed" : "series-line"}
            fill="none"
            stroke={line.color}
            strokeWidth={line.width ?? 2.25}
            pathLength={line.dash ? undefined : 1}
            strokeDasharray={line.dash ? "7 5" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {marker && model.axis.includes(marker.date) ? (
          <g>
            <line
              x1={model.xOf(marker.date)}
              x2={model.xOf(marker.date)}
              y1={PAD.t}
              y2={HEIGHT - PAD.b}
              className="marker"
            />
            <text x={model.xOf(marker.date) - 6} y={PAD.t + 12} className="marker-label" textAnchor="end">
              {marker.label}
            </text>
          </g>
        ) : null}
        {active ? (
          <line
            x1={model.xOf(active)}
            x2={model.xOf(active)}
            y1={PAD.t}
            y2={HEIGHT - PAD.b}
            className="hover-line"
          />
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
