'use client'

import { useState, useTransition } from 'react'
import { requestReward } from './actions'
import { NIVEL_NAMES, NIVEL_BORDER_COLORS } from '@/lib/types'
import type { Creator, NivelRequirement, NivelReward, RewardRequest } from '@/lib/types'

interface Props {
  creator: Creator
  requirements: NivelRequirement[]
  rewards: NivelReward[]
  myRequests: RewardRequest[]
}

export default function NivelesClient({ creator, requirements, rewards, myRequests }: Props) {
  const [modalReward, setModalReward] = useState<NivelReward | null>(null)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [requestedIds, setRequestedIds] = useState<Set<string>>(
    new Set(myRequests.map((r) => r.reward_id))
  )

  const rewardsForNivel = (nivel: number) => rewards.filter((r) => r.nivel === nivel)

  function handleSubmit() {
    if (!modalReward) return
    setErrorMsg('')
    setSuccessMsg('')
    startTransition(async () => {
      const result = await requestReward({
        creator_id: creator.id,
        creator_name: creator.full_name,
        tiktok_handle: creator.tiktok_handle,
        nivel: creator.nivel,
        reward_id: modalReward.id,
        reward_name: modalReward.reward_name,
        notes: notes.trim() || null,
      })
      if (result.error) {
        setErrorMsg(result.error)
      } else {
        setRequestedIds((prev) => new Set([...Array.from(prev), modalReward.id]))
        setSuccessMsg('¡Solicitud enviada! Te contactamos pronto 🧡')
        setTimeout(() => {
          setModalReward(null)
          setNotes('')
          setSuccessMsg('')
        }, 2000)
      }
    })
  }

  return (
    <>
      <div className="space-y-5">
        {[1, 2, 3, 4].map((nivel) => {
          const req = requirements.find((r) => r.nivel === nivel)
          if (!req) return null

          const isPast = nivel < creator.nivel
          const isCurrent = nivel === creator.nivel
          const isFuture = nivel > creator.nivel
          const nivelRewards = rewardsForNivel(nivel)
          const borderColor = NIVEL_BORDER_COLORS[nivel] ?? '#ff7700'
          const name = NIVEL_NAMES[nivel] ?? `Nivel ${nivel}`

          const videosProgress = isCurrent
            ? Math.min(100, req.total_videos_required > 0 ? (creator.videos_this_month / req.total_videos_required) * 100 : 100)
            : 0
          const gmvProgress = isCurrent
            ? Math.min(100, req.gmv_required > 0 ? (creator.gmv_this_month / req.gmv_required) * 100 : 100)
            : 0

          // For future levels, calculate what's missing
          const videosMissing = isFuture ? Math.max(0, req.total_videos_required - creator.videos_this_month) : 0
          const gmvMissing = isFuture ? Math.max(0, req.gmv_required - creator.gmv_this_month) : 0

          return (
            <div
              key={nivel}
              className={`relative bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] overflow-hidden transition-all ${
                isCurrent ? 'shadow-[0_0_20px_rgba(255,119,0,0.3)]' : ''
              } ${isPast ? 'bg-green-50/40' : ''}`}
            >
              {/* Left colored border strip */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: borderColor }}
              />

              {/* Locked overlay for future levels */}
              {isFuture && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 rounded-2xl flex flex-col items-center justify-center text-center px-6">
                  <span className="text-3xl mb-2">🔒</span>
                  <p className="font-syne font-bold text-sm text-gray-500">
                    Desbloquea cuando llegues a {req.total_videos_required} videos y ${req.gmv_required.toLocaleString()} GMV
                  </p>
                  <p className="font-dm text-xs text-gray-400 mt-1">
                    Te faltan {videosMissing} videos y ${gmvMissing.toLocaleString()}
                  </p>
                </div>
              )}

              <div className="flex flex-col md:flex-row pl-4 pr-5 py-5 gap-5">
                {/* Left section: nivel info + requirements */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    {isPast && <span className="text-green-500 text-lg">✅</span>}
                    <span
                      className="font-syne font-extrabold text-lg px-3 py-0.5 rounded-xl"
                      style={{
                        backgroundColor: `${borderColor}20`,
                        color: borderColor,
                      }}
                    >
                      {nivel}
                    </span>
                    <h3 className={`font-syne font-bold text-lg ${isPast ? 'text-gray-400' : 'text-go-dark'}`}>
                      {name}
                    </h3>
                    {isCurrent && (
                      <span className="font-dm text-[11px] font-bold px-3 py-0.5 rounded-full bg-go-orange text-white">
                        Tu nivel
                      </span>
                    )}
                  </div>

                  {/* Requirement pills */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`font-dm text-xs px-2.5 py-1 rounded-full ${isPast ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                      ACC: {req.acc_required}
                    </span>
                    <span className={`font-dm text-xs px-2.5 py-1 rounded-full ${isPast ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                      TTD: {req.ttd_required}
                    </span>
                    <span className={`font-dm text-xs px-2.5 py-1 rounded-full ${isPast ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                      Videos: {req.total_videos_required}
                    </span>
                    <span className={`font-dm text-xs px-2.5 py-1 rounded-full ${isPast ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                      GMV: ${req.gmv_required.toLocaleString()}
                    </span>
                  </div>

                  {req.perks && (
                    <p className={`font-dm text-xs ${isPast ? 'text-gray-400' : 'text-gray-500'}`}>
                      {req.perks}
                    </p>
                  )}

                  {/* Progress bars for current level */}
                  {isCurrent && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-dm text-xs text-gray-500">
                            Videos: {creator.videos_this_month} / {req.total_videos_required}
                          </span>
                          <span className="font-dm text-xs font-semibold text-go-orange">
                            {Math.round(videosProgress)}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-go-orange rounded-full transition-all"
                            style={{ width: `${videosProgress}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-dm text-xs text-gray-500">
                            GMV: ${creator.gmv_this_month.toLocaleString()} / ${req.gmv_required.toLocaleString()}
                          </span>
                          <span className="font-dm text-xs font-semibold text-go-orange">
                            {Math.round(gmvProgress)}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-go-orange rounded-full transition-all"
                            style={{ width: `${gmvProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right section: rewards */}
                {nivelRewards.length > 0 && (
                  <div className={`md:w-64 shrink-0 ${isFuture ? 'opacity-30 blur-[1px]' : ''}`}>
                    <h4 className="font-syne font-bold text-sm text-go-dark mb-2">
                      🎁 Lo que puedes pedir
                    </h4>
                    <div className="space-y-2">
                      {nivelRewards.map((reward) => {
                        const alreadyRequested = requestedIds.has(reward.id)
                        return (
                          <div
                            key={reward.id}
                            className="flex items-start justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="font-dm text-xs font-semibold text-go-dark">
                                {reward.reward_emoji} {reward.reward_name}
                              </p>
                              {reward.reward_description && (
                                <p className="font-dm text-[11px] text-gray-400 mt-0.5 leading-tight">
                                  {reward.reward_description}
                                </p>
                              )}
                            </div>
                            {(isPast || isCurrent) && !isFuture && (
                              <div className="shrink-0">
                                {alreadyRequested ? (
                                  <span className="font-dm text-[11px] text-gray-400 font-medium whitespace-nowrap">
                                    Solicitado ✓
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setModalReward(reward)
                                      setNotes('')
                                      setErrorMsg('')
                                      setSuccessMsg('')
                                    }}
                                    className="font-dm text-[11px] text-go-orange font-semibold hover:underline whitespace-nowrap"
                                  >
                                    Solicitar →
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Request Modal */}
      {modalReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => {
                setModalReward(null)
                setNotes('')
                setErrorMsg('')
                setSuccessMsg('')
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>

            {successMsg ? (
              <div className="text-center py-6">
                <p className="text-4xl mb-3">🎉</p>
                <p className="font-syne font-bold text-lg text-go-dark">{successMsg}</p>
              </div>
            ) : (
              <>
                <h3 className="font-syne font-bold text-lg text-go-dark mb-1">
                  ¿Quieres solicitar {modalReward.reward_emoji} {modalReward.reward_name}?
                </h3>
                <p className="font-dm text-sm text-gray-400 mb-5">
                  Te contactaremos para coordinar tu reward.
                </p>

                <label className="block font-dm text-xs font-semibold text-gray-500 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Me gustaría recibirlo antes del viernes..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 font-dm text-sm text-go-dark placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-go-orange/30 resize-none mb-4"
                />

                {errorMsg && (
                  <p className="font-dm text-xs text-red-500 mb-3">{errorMsg}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="w-full bg-go-orange text-white font-syne font-bold text-sm py-3 rounded-xl hover:bg-go-orange/90 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Enviando...' : 'Solicitar reward'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
