import { type BusyBlock } from "./calendar-state"

export interface FreeSlot {
  day: number // 0 = Monday, 6 = Sunday
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
}

/**
 * Calculates common free time slots across all users
 * Returns time blocks where no one has a "Busy" entry
 */
export function calculateCommonFreeSlots(
  busyBlocks: BusyBlock[],
  weekStart: Date
): FreeSlot[] {
  const freeSlots: FreeSlot[] = []
  const DAYS_IN_WEEK = 7
  const MINUTES_PER_DAY = 24 * 60

  // For each day of the week
  for (let day = 0; day < DAYS_IN_WEEK; day++) {
    // Create an array representing each minute of the day (0-1439)
    const busyMinutes = new Set<number>()

    // Mark all busy minutes for this day
    busyBlocks
      .filter((block) => block.day === day)
      .forEach((block) => {
        const startMinute = block.startHour * 60 + block.startMinute
        const endMinute = block.endHour * 60 + block.endMinute

        // Mark all minutes in this block as busy
        for (let minute = startMinute; minute < endMinute; minute++) {
          busyMinutes.add(minute)
        }
      })

    // Find free time slots (contiguous ranges of free minutes)
    let currentSlotStart: number | null = null

    for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
      const isBusy = busyMinutes.has(minute)

      if (!isBusy && currentSlotStart === null) {
        // Start of a new free slot
        currentSlotStart = minute
      } else if (isBusy && currentSlotStart !== null) {
        // End of a free slot
        const startHour = Math.floor(currentSlotStart / 60)
        const startMin = currentSlotStart % 60
        const endHour = Math.floor((minute - 1) / 60)
        const endMin = (minute - 1) % 60

        // Only add slots that are at least 30 minutes long
        if (minute - currentSlotStart >= 30) {
          freeSlots.push({
            day,
            startHour,
            startMinute: startMin,
            endHour,
            endMinute: endMin,
          })
        }
        currentSlotStart = null
      }
    }

    // Handle free slot that extends to end of day
    if (currentSlotStart !== null) {
      const remainingMinutes = MINUTES_PER_DAY - currentSlotStart
      if (remainingMinutes >= 30) {
        const startHour = Math.floor(currentSlotStart / 60)
        const startMin = currentSlotStart % 60
        freeSlots.push({
          day,
          startHour,
          startMinute: startMin,
          endHour: 23,
          endMinute: 59,
        })
      }
    }
  }

  return freeSlots
}

/**
 * Formats a free slot for display
 */
export function formatFreeSlot(slot: FreeSlot): string {
  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const displayMinute = minute.toString().padStart(2, "0")
    return `${displayHour}:${displayMinute} ${period}`
  }

  return `${formatTime(slot.startHour, slot.startMinute)} - ${formatTime(slot.endHour, slot.endMinute)}`
}

