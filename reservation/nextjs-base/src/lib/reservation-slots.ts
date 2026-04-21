/**
 * Shared reservation slot configuration.
 * These defaults must match the values used in ReservationBlock.
 */

export const LUNCH_START = '11:00'
export const LUNCH_END = '13:00'
export const DINNER_START = '18:00'
export const DINNER_END = '20:00'

export function generateSlots(
  start: string,
  end: string,
  stepMin = 30
): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let current = sh * 60 + sm
  const endTotal = eh * 60 + em
  while (current <= endTotal) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += stepMin
  }
  return slots
}

export const LUNCH_SLOTS = generateSlots(LUNCH_START, LUNCH_END)
export const DINNER_SLOTS = generateSlots(DINNER_START, DINNER_END)
export const ALL_RESERVATION_SLOTS = [...LUNCH_SLOTS, ...DINNER_SLOTS]
