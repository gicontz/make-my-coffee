export function calcShipping(city: string, subtotal: number): number {
  const normalized = city.trim().toLowerCase().replace(/\s*city\s*$/i, '')
  return normalized === 'pasig' && subtotal >= 1000 ? 0 : 99
}
