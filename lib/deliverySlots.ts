// Delivery time-slot picker (checkout). Hourly windows 9am–7pm, grouped into
// two periods. Single source of truth — used by the checkout UI, the
// /api/orders validation, and the admin orders display.

export type SlotPeriod = 'morning' | 'afternoon'

export interface DeliverySlot {
  id: string
  label: string
  period: SlotPeriod
}

export const DELIVERY_SLOTS: DeliverySlot[] = [
  { id: '09-10', label: '9:00 – 10:00 AM', period: 'morning' },
  { id: '10-11', label: '10:00 – 11:00 AM', period: 'morning' },
  { id: '11-12', label: '11:00 AM – 12:00 PM', period: 'morning' },
  { id: '12-13', label: '12:00 – 1:00 PM', period: 'afternoon' },
  { id: '13-14', label: '1:00 – 2:00 PM', period: 'afternoon' },
  { id: '14-15', label: '2:00 – 3:00 PM', period: 'afternoon' },
  { id: '15-16', label: '3:00 – 4:00 PM', period: 'afternoon' },
  { id: '16-17', label: '4:00 – 5:00 PM', period: 'afternoon' },
  { id: '17-18', label: '5:00 – 6:00 PM', period: 'afternoon' },
  { id: '18-19', label: '6:00 – 7:00 PM', period: 'afternoon' },
]

export const DELIVERY_SLOT_IDS = DELIVERY_SLOTS.map(s => s.id)

export const PERIOD_LABEL: Record<SlotPeriod, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon – Evening',
}

export function slotsInPeriod(period: SlotPeriod): DeliverySlot[] {
  return DELIVERY_SLOTS.filter(s => s.period === period)
}

export function slotLabel(id: string): string {
  return DELIVERY_SLOTS.find(s => s.id === id)?.label ?? id
}

// A valid selection: only known slot ids, at least one from each period.
// Same rule enforced client-side (for immediate feedback) and server-side
// (source of truth — never trust the client), matching the pattern used for
// VALID_ORDER_STATUSES in app/api/admin/orders/[id]/route.ts.
export function validateDeliverySlots(ids: unknown): string | null {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 'Select at least one delivery time.'
  }
  if (!ids.every(id => typeof id === 'string' && DELIVERY_SLOT_IDS.includes(id))) {
    return 'Invalid delivery time selected.'
  }
  const hasMorning = ids.some(id => slotsInPeriod('morning').some(s => s.id === id))
  const hasAfternoon = ids.some(id => slotsInPeriod('afternoon').some(s => s.id === id))
  if (!hasMorning || !hasAfternoon) {
    return 'Choose at least one morning and one afternoon–evening delivery time.'
  }
  return null
}
