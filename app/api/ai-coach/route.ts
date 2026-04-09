import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT =
  'Eres el AI Coach de Papaya GO, una comunidad de creadoras Latinas en TikTok GO en Estados Unidos. Generas contenido específico para ayudar a creadoras a monetizar hoteles, atracciones y restaurantes en TikTok GO. Siempre responde en español. Tono: cálido, directo, motivador. Para hooks: máximo 3 líneas, debe enganchar en los primeros 2 segundos. Para captions: incluye siempre #tiktokgostay y 3 hashtags relevantes. Para voiceovers: exactamente 30 segundos al hablar normal, conversacional. Para ideas: da 5 ideas numeradas.'

const CONTENT_TYPE_LABELS: Record<string, string> = {
  hook: 'un hook (frase de apertura que atrapa en 2 segundos)',
  caption: 'un caption para TikTok con #tiktokgostay y hashtags relevantes',
  voiceover: 'un voiceover de exactamente 30 segundos, tono conversacional',
  ideas: '5 ideas de video numeradas',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { poi_name, poi_city, poi_state, poi_type, poi_commission, content_type } = body

    if (!poi_name || !content_type) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos.' },
        { status: 400 }
      )
    }

    const contentLabel = CONTENT_TYPE_LABELS[content_type] ?? content_type

    const locationPart =
      poi_city && poi_state
        ? `${poi_name} en ${poi_city}, ${poi_state}`
        : poi_name

    const typePart = poi_type ? ` Tipo de lugar: ${poi_type}.` : ''
    const commissionPart = poi_commission ? ` Comisión: ${poi_commission}.` : ''

    const userPrompt = `Genera ${contentLabel} para un video de TikTok GO sobre ${locationPart}.${typePart}${commissionPart}`

    // If no API key, return a mock response for development
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        text: `[Modo desarrollo — API key no configurada]\n\nEjemplo de ${contentLabel} para ${poi_name}:\n\nEste es un contenido de ejemplo generado localmente. Configura ANTHROPIC_API_KEY en tu archivo .env.local para obtener respuestas reales del AI Coach.`,
      })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    return NextResponse.json({ text })
  } catch (err: unknown) {
    console.error('AI Coach error:', err)
    const errorMessage =
      err instanceof Error ? err.message : 'Error interno del servidor.'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
