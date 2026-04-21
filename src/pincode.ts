// Async PIN → City lookup via India Post's public API.
// Falls back to null on any network / parse error. In-memory cache to avoid re-fetching.

const cache = new Map<string, string | null>()

export async function fetchCityFromPin(pin: string | number): Promise<string | null> {
  const key = String(pin)
  if (!/^\d{6}$/.test(key)) return null
  if (cache.has(key)) return cache.get(key) ?? null
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${key}`)
    const data = await r.json()
    const po = data?.[0]?.PostOffice?.[0]
    const city = po?.District || po?.Block || po?.Name || null
    cache.set(key, city)
    return city
  } catch {
    cache.set(key, null)
    return null
  }
}
