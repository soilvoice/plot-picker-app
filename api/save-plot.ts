// Vercel Edge Function — save polygon to Airtable
// ─────────────────────────────────────────────────────────────────────────────
// SETUP: Place this file at  api/save-plot.ts  inside the plot-picker-app repo
// (create the api/ folder next to src/ if it doesn't exist)
//
// In Vercel → Settings → Environment Variables, add:
//   AIRTABLE_API_KEY   = your Airtable personal access token
//   AIRTABLE_BASE_ID   = appKbD5FWnQqXBolL
// ─────────────────────────────────────────────────────────────────────────────

export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const env = process.env as Record<string, string>
  const AIRTABLE_API_KEY = env.AIRTABLE_API_KEY
  const AIRTABLE_BASE_ID = env.AIRTABLE_BASE_ID

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return new Response(JSON.stringify({ error: 'Missing Airtable env vars' }), { status: 500 })
  }

  let body: { plot_id: string; coordinates: [number, number][] }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { plot_id, coordinates } = body
  if (!plot_id || !coordinates?.length) {
    return new Response(JSON.stringify({ error: 'Missing plot_id or coordinates' }), { status: 400 })
  }

  // Format as text: "1. [lng, lat]\n2. [lng, lat]\n..."
  const coordsText = coordinates
    .map(([lng, lat], i) => `${i + 1}. [${lng.toFixed(6)}, ${lat.toFixed(6)}]`)
    .join('\n')

  // Simple centroid (average lat/lng)
  const avgLat = coordinates.reduce((s, [, lat]) => s + lat, 0) / coordinates.length
  const avgLng = coordinates.reduce((s, [lng]) => s + lng, 0) / coordinates.length
  const centroidText = `${avgLat.toFixed(6)}, ${avgLng.toFixed(6)}`

  const r = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Plots/${plot_id}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          Coordinates: coordsText,
          'Sampling point': centroidText,
          Status: 'Awaiting sampling',
        },
      }),
    }
  )

  if (!r.ok) {
    const err = await r.text()
    return new Response(JSON.stringify({ error: err }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
