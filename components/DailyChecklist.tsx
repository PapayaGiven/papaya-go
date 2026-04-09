'use client'

import { useState } from 'react'

interface DailyChecklistProps {
  items: string[]
}

export default function DailyChecklist({ items }: DailyChecklistProps) {
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false))

  function toggle(index: number) {
    setChecked((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const done = checked.filter(Boolean).length

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <label
          key={i}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <button
            type="button"
            onClick={() => toggle(i)}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
              checked[i]
                ? 'bg-go-orange border-go-orange text-white'
                : 'border-gray-300 group-hover:border-go-orange/50'
            }`}
          >
            {checked[i] && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span
            className={`font-dm text-sm transition-colors ${
              checked[i] ? 'line-through text-gray-400' : 'text-go-dark'
            }`}
          >
            {item}
          </span>
        </label>
      ))}
      {done === items.length && items.length > 0 && (
        <p className="font-dm text-sm text-green-600 font-semibold pt-1">
          🎉 ¡Completaste todo por hoy!
        </p>
      )}
    </div>
  )
}
