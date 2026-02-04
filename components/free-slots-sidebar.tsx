"use client"

import { addDays, format } from "date-fns"
import { Users } from "lucide-react"
import { type FreeSlot } from "@/lib/free-time-calculator"
import { formatFreeSlot } from "@/lib/free-time-calculator"

interface FreeSlotsSidebarProps {
  freeSlots: FreeSlot[]
  weekStart: Date
  memberCount: number
  groupCode: string
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export function FreeSlotsSidebar({ freeSlots, weekStart, memberCount, groupCode }: FreeSlotsSidebarProps) {
  // If only one person in group, show invite prompt
  if (memberCount <= 1) {
    return (
      <div className="w-80 border-l bg-card h-screen overflow-y-auto sticky top-0">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Common Free Slots</h2>
            <p className="text-sm text-muted-foreground">
              Times when everyone is available
            </p>
          </div>

          <div className="border rounded-sm p-6 bg-muted/20 text-center space-y-4">
            <Users className="h-12 w-12 mx-auto text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="font-semibold">Invite Your Friends</h3>
              <p className="text-sm text-muted-foreground">
                Share your group code with friends to see when everyone is free together.
              </p>
            </div>
            <div className="pt-4 border-t">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Group Code</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-2xl font-mono font-bold tracking-wider bg-background px-4 py-2 rounded-sm border">
                    {groupCode}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Share this code so others can join your group
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Group free slots by day
  const slotsByDay = freeSlots.reduce((acc, slot) => {
    if (!acc[slot.day]) {
      acc[slot.day] = []
    }
    acc[slot.day].push(slot)
    return acc
  }, {} as Record<number, FreeSlot[]>)

  // Sort days and slots within each day
  const sortedDays = Object.keys(slotsByDay)
    .map(Number)
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      date: addDays(weekStart, day),
      slots: slotsByDay[day].sort((a, b) => {
        const aStart = a.startHour * 60 + a.startMinute
        const bStart = b.startHour * 60 + b.startMinute
        return aStart - bStart
      }),
    }))

  return (
    <div className="w-80 border-l bg-card h-screen overflow-y-auto sticky top-0">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">Common Free Slots</h2>
          <p className="text-sm text-muted-foreground">
            Times when everyone is available
          </p>
        </div>

        {sortedDays.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No common free time slots found this week.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDays.map(({ day, date, slots }) => (
              <div key={day} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">
                    {DAY_NAMES[day]}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {format(date, "MMM d")}
                  </span>
                </div>
                <div className="space-y-1.5 pl-2 border-l-2 border-muted">
                  {slots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="text-sm py-1.5 px-2 rounded-sm bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="font-mono text-xs">
                        {formatFreeSlot(slot)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

