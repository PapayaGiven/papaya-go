'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const NO_LEGEND = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
    x: { grid: { display: false } },
  },
}

const WITH_LEGEND = {
  ...NO_LEGEND,
  plugins: { legend: { position: 'top' as const, labels: { font: { size: 11 } } } },
}

export interface SnapshotPoint {
  month: number
  year: number
  acc: number
  ttd: number
  gmv: number
  creators: number
}

export function MonthlyAccTtdBars({ data }: { data: SnapshotPoint[] }) {
  const labels = data.map((p) => `${MONTHS_ES[p.month - 1]} ${String(p.year).slice(2)}`)
  return (
    <div style={{ height: 280 }}>
      <Bar
        data={{
          labels,
          datasets: [
            { label: 'ACC', data: data.map((p) => p.acc), backgroundColor: '#ff7700', borderRadius: 6 },
            { label: 'TTD', data: data.map((p) => p.ttd), backgroundColor: '#ff9ece', borderRadius: 6 },
          ],
        }}
        options={WITH_LEGEND}
      />
    </div>
  )
}

export function GmvLine({ data }: { data: SnapshotPoint[] }) {
  const labels = data.map((p) => `${MONTHS_ES[p.month - 1]} ${String(p.year).slice(2)}`)
  return (
    <div style={{ height: 240 }}>
      <Line
        data={{
          labels,
          datasets: [{
            label: 'GMV',
            data: data.map((p) => p.gmv),
            borderColor: '#ff7700',
            backgroundColor: 'rgba(255,119,0,0.12)',
            tension: 0.3,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#ff7700',
          }],
        }}
        options={NO_LEGEND}
      />
    </div>
  )
}

export function CreatorsLine({ data }: { data: SnapshotPoint[] }) {
  const labels = data.map((p) => `${MONTHS_ES[p.month - 1]} ${String(p.year).slice(2)}`)
  return (
    <div style={{ height: 240 }}>
      <Line
        data={{
          labels,
          datasets: [{
            label: 'Creadoras',
            data: data.map((p) => p.creators),
            borderColor: '#ff9ece',
            backgroundColor: 'rgba(255,158,206,0.18)',
            tension: 0.3,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#ff9ece',
          }],
        }}
        options={NO_LEGEND}
      />
    </div>
  )
}
