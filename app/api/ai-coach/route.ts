import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = 'Eres el AI Coach de Papaya GO, una comunidad de creadoras Latinas en TikTok GO en Estados Unidos. Generas contenido específico para ayudar a creadoras a monetizar hoteles, atracciones y restaurantes en TikTok GO. Siempre responde en español. Tono: cálido, directo, motivador. Para hooks: máximo 3 líneas, debe enganchar en los primeros 2 segundos. Para captions: incluye siempre #tiktokgostay y 3 hashtags relevantes. Para voiceovers: exactamente 30 segundos al hablar normal, conversacional. Para ideas: da 5 ideas numeradas.'

const CONTENT_TYPE_LABELS: Record<string, string> = {
  hook: 'un hook (frase de apertura que atrapa en 2 segundos)',
  caption: 'un caption para TikTok con #tiktokgostay y hashtags relevantes',
  voiceover: 'un voiceover de exactamente 30 segundos, tono conversacional',
  ideas: '5 ideas de video numeradas',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, place_name, content_type } = body

    if (!content_type || (!url && !place_name)) {
      return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 })
    }

    const contentLabel = CONTENT_TYPE_LABELS[content_type] ?? content_type

    // Try to fetch URL content for context
    let urlContext = ''
    if (url) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const html = await res.text()
          // Strip HTML tags and get first 2000 chars
          const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          urlContext = text.substring(0, 2000)
        }
      } catch {
        // URL fetch failed, continue without it
      }
    }

    const locationPart = place_name || url || 'un lugar'
    let userPrompt = `Genera ${contentLabel} para un video de TikTok GO sobre ${locationPart}.`
    if (url) userPrompt += ` URL del lugar: ${url}.`
    if (urlContext) userPrompt += ` Información del lugar: ${urlContext}`
    userPrompt += ' Usa la información para hacer el contenido específico y auténtico.'

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'placeholder-add-your-key') {
      return NextResponse.json({
        text: `[Modo desarrollo — API key no configurada]\n\nEjemplo de ${contentLabel} para ${locationPart}:\n\nEste es contenido de ejemplo. Configura ANTHROPIC_API_KEY para respuestas reales.`,
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
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno.' }, { status: 500 })
  }
}
