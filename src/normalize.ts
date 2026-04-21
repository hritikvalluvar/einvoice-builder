// Normalizers for dedup keys. Store raw user input; only use these for *matching*.

export const normProductName = (s: string): string =>
  (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

export const normGstin = (s: string): string =>
  (s ?? '').trim().toUpperCase()
