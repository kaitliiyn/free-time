"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { startOfWeek, addDays, format, eachHourOfInterval, startOfDay, endOfDay } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { calendarState, type BusyBlock } from "@/lib/calendar-state"
import { calculateCommonFreeSlots, type FreeSlot } from "@/lib/free-time-calculator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { X, Plus, ChevronDown, ChevronUp } from "lucide-react"

interface CalendarProps {
  currentUserId: string
  currentUserName: string
  groupCode: string
  freeSlots?: FreeSlot[]
  onFreeSlotsChange?: (slots: FreeSlot[]) => void
  onWeekStartChange?: (weekStart: Date) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function Calendar({ currentUserId, currentUserName, groupCode, freeSlots: externalFreeSlots, onFreeSlotsChange, onWeekStartChange }: CalendarProps) {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    return startOfWeek(today, { weekStartsOn: 1 }) // Monday
  })

  // Notify parent of week start changes
  useEffect(() => {
    if (onWeekStartChange) {
      onWeekStartChange(weekStart)
    }
  }, [weekStart, onWeekStartChange])
  const [blocks, setBlocks] = useState<BusyBlock[]>([])
  const [dragging, setDragging] = useState<{
    day: number
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
  } | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<BusyBlock | null>(null)
  const [pendingDrag, setPendingDrag] = useState<{
    day: number
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
  } | null>(null)
  const [editingBlock, setEditingBlock] = useState<{
    day: number
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
  } | null>(null)
  const [draggingBlock, setDraggingBlock] = useState<BusyBlock | null>(null)
  const [dragTargetDay, setDragTargetDay] = useState<number | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [recurring, setRecurring] = useState(false)
  const [showGroupAvailability, setShowGroupAvailability] = useState(false)
  const [manualInput, setManualInput] = useState({
    day: 0,
    startHour: 9,
    startMinute: 0,
    endHour: 10,
    endMinute: 0,
  })
  const [expandedMorning, setExpandedMorning] = useState(false) // 12am-5am (0-5)
  const [expandedNight, setExpandedNight] = useState(false) // 10pm-11pm (22-23)
  const calendarRef = useRef<HTMLDivElement>(null)

  // Show 6am-9pm (6-21) by default, plus morning/night when expanded
  // Memoize to prevent unnecessary re-renders and fix React hooks warnings
  const visibleHours = useMemo(() => [
    ...(expandedMorning ? HOURS.filter(h => h >= 0 && h <= 5) : []),
    ...HOURS.filter(h => h >= 6 && h <= 21), // Always show 6am-9pm
    ...(expandedNight ? HOURS.filter(h => h >= 22 && h <= 23) : []),
  ], [expandedMorning, expandedNight])

  // Load blocks from Supabase and listen for changes
  const loadBlocks = useCallback(async () => {
    const blocks = await calendarState.getBlocksForWeek(groupCode, weekStart)
    setBlocks(blocks)
  }, [groupCode, weekStart])

  useEffect(() => {
    loadBlocks()

    // Subscribe to real-time updates
    const unsubscribe = calendarState.subscribeToSchedules(groupCode, (updatedBlocks) => {
      setBlocks(updatedBlocks)
    })

    return () => {
      unsubscribe()
    }
  }, [groupCode, weekStart, loadBlocks])

  // Calculate free slots - memoize to prevent unnecessary recalculations
  const calculatedFreeSlots = useMemo(() => {
    return calculateCommonFreeSlots(blocks, weekStart)
  }, [blocks, weekStart])
  
  const freeSlots = externalFreeSlots ?? calculatedFreeSlots

  // Notify parent of free slots changes
  useEffect(() => {
    if (onFreeSlotsChange) {
      onFreeSlotsChange(calculatedFreeSlots)
    }
  }, [calculatedFreeSlots, onFreeSlotsChange])

  const getDayDate = (dayIndex: number) => {
    return addDays(weekStart, dayIndex)
  }

  const HOUR_HEIGHT = 40 // Condensed: 40px per hour instead of 60px
  
  // Calculate position of a block based on visible hours
  // This accounts for which hours are actually displayed and their order
  // This function should return the same value for the same hour/minute regardless of day
  const getHourPosition = useCallback((hour: number, minute: number = 0) => {
    // Find the index of this hour in the visible hours array
    const hourIndex = visibleHours.indexOf(hour)
    
    // If hour is not visible, return a position based on where it would be
    if (hourIndex === -1) {
      // Hour is not visible, calculate position relative to visible hours
      if (visibleHours.length === 0) return 0
      const firstVisibleHour = Math.min(...visibleHours)
      const lastVisibleHour = Math.max(...visibleHours)
      
      if (hour < firstVisibleHour) {
        // Hour is before visible range (e.g., hour 3 when showing 6-21)
        return -((firstVisibleHour - hour) * HOUR_HEIGHT)
      } else {
        // Hour is after visible range (e.g., hour 22 when showing 6-21)
        const visibleHeight = visibleHours.length * HOUR_HEIGHT
        return visibleHeight + ((hour - lastVisibleHour - 1) * HOUR_HEIGHT)
      }
    }
    
    // Hour is visible, calculate its position
    // Account for the expand button at top if morning is not expanded
    const topButtonHeight = !expandedMorning ? HOUR_HEIGHT : 0
    const position = (hourIndex * HOUR_HEIGHT) + topButtonHeight + (minute / 60) * HOUR_HEIGHT
    
    return position
  }, [visibleHours, expandedMorning])

  const getPositionFromEvent = (e: React.MouseEvent, dayIndex: number) => {
    if (!calendarRef.current || visibleHours.length === 0) return null

    const rect = calendarRef.current.getBoundingClientRect()
    const dayRect = (calendarRef.current.querySelector(
      `[data-day="${dayIndex}"]`
    ) as HTMLElement)?.getBoundingClientRect()

    if (!dayRect) return null

    const x = e.clientX - dayRect.left
    let y = e.clientY - dayRect.top

    // Account for the top button if morning is not expanded
    const topButtonHeight = !expandedMorning ? HOUR_HEIGHT : 0
    y = y - topButtonHeight

    // Calculate which visible hour slot we're in
    const hourIndex = Math.floor(y / HOUR_HEIGHT)
    const minute = Math.floor(((y % HOUR_HEIGHT) / HOUR_HEIGHT) * 60)
    
    // Map to actual hour from visible hours array
    const clampedHourIndex = Math.max(0, Math.min(visibleHours.length - 1, hourIndex))
    const actualHour = visibleHours[clampedHourIndex]
    const clampedHour = Math.max(0, Math.min(23, actualHour))
    const clampedMinute = Math.floor(minute / 30) * 30 // Snap to 30-minute intervals (half-hour)

    return { hour: clampedHour, minute: clampedMinute }
  }

  const handleMouseDown = (e: React.MouseEvent, dayIndex: number) => {
    if (e.button !== 0) return // Only left mouse button
    const pos = getPositionFromEvent(e, dayIndex)
    if (!pos) return

    setDragging({
      day: dayIndex,
      startHour: pos.hour,
      startMinute: pos.minute,
      endHour: pos.hour,
      endMinute: pos.minute,
    })
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || visibleHours.length === 0) return
      const dayElement = calendarRef.current?.querySelector(
        `[data-day="${dragging.day}"]`
      ) as HTMLElement
      if (!dayElement) return

      const rect = dayElement.getBoundingClientRect()
      let y = e.clientY - rect.top

      // Account for the top button if morning is not expanded
      const topButtonHeight = !expandedMorning ? HOUR_HEIGHT : 0
      y = y - topButtonHeight

      // Calculate which visible hour slot we're in
      const hourIndex = Math.floor(y / HOUR_HEIGHT)
      const minute = Math.floor(((y % HOUR_HEIGHT) / HOUR_HEIGHT) * 60)
      
      // Map to actual hour from visible hours array
      const clampedHourIndex = Math.max(0, Math.min(visibleHours.length - 1, hourIndex))
      const actualHour = visibleHours[clampedHourIndex]
      const clampedHour = Math.max(0, Math.min(23, actualHour))
      const clampedMinute = Math.floor(minute / 30) * 30 // Snap to 30-minute intervals

      // Ensure end is after start
      const endHour =
        clampedHour > dragging.startHour ||
        (clampedHour === dragging.startHour && clampedMinute > dragging.startMinute)
          ? clampedHour
          : dragging.startHour + 1
      const endMinute =
        endHour === dragging.startHour
          ? Math.max(dragging.startMinute + 30, clampedMinute)
          : clampedMinute

      setDragging({
        ...dragging,
        endHour,
        endMinute,
      })
    },
    [dragging, visibleHours, expandedMorning]
  )

  const handleMouseUp = useCallback(() => {
    if (!dragging) return

    const { day, startHour, startMinute, endHour, endMinute } = dragging

    // Only create block if there's a meaningful duration (at least 30 minutes)
    const startTotal = startHour * 60 + startMinute
    const endTotal = endHour * 60 + endMinute
    const duration = endTotal - startTotal

    if (duration >= 30) {
      setPendingDrag({
        day,
        startHour,
        startMinute,
        endHour,
        endMinute,
      })
      setLabel("")
      setRecurring(false)
      setSelectedBlock(null)
      setPopoverOpen(true)
    }

    setDragging(null)
  }, [dragging])

  useEffect(() => {
    if (dragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  // Handle block drag cleanup
  useEffect(() => {
    const handleMouseUpGlobal = () => {
      if (draggingBlock) {
        setDraggingBlock(null)
        setDragTargetDay(null)
      }
    }
    
    if (draggingBlock) {
      document.addEventListener("mouseup", handleMouseUpGlobal)
      return () => {
        document.removeEventListener("mouseup", handleMouseUpGlobal)
      }
    }
  }, [draggingBlock])

  const handleSaveBlock = useCallback(async () => {
    if (!pendingDrag && !selectedBlock && !editingBlock) return

    // Prevent editing other users' blocks
    if (selectedBlock && selectedBlock.userId !== currentUserId) {
      return
    }

    const blockData = editingBlock || pendingDrag || {
      day: selectedBlock!.day,
      startHour: selectedBlock!.startHour,
      startMinute: selectedBlock!.startMinute,
      endHour: selectedBlock!.endHour,
      endMinute: selectedBlock!.endMinute,
    }

    if (selectedBlock && editingBlock) {
      // Editing existing block with new times
      await calendarState.updateBlock(groupCode, selectedBlock.id, {
        day: blockData.day,
        startHour: blockData.startHour,
        startMinute: blockData.startMinute,
        endHour: blockData.endHour,
        endMinute: blockData.endMinute,
        label: label || "Busy",
        recurring,
      })
    } else if (selectedBlock) {
      // Just updating label/recurring
      await calendarState.updateBlock(groupCode, selectedBlock.id, {
        label: label || "Busy",
        recurring,
      })
    } else {
      // Creating new block
      await calendarState.addBlock({
        userId: currentUserId,
        userName: currentUserName,
        groupCode,
        day: blockData.day,
        startHour: blockData.startHour,
        startMinute: blockData.startMinute,
        endHour: blockData.endHour,
        endMinute: blockData.endMinute,
        label: label || "Busy",
        recurring,
      })
    }

    // Reload blocks immediately after saving
    await loadBlocks()

    setPopoverOpen(false)
    setSelectedBlock(null)
    setPendingDrag(null)
    setEditingBlock(null)
    setLabel("")
    setRecurring(false)
  }, [pendingDrag, selectedBlock, editingBlock, groupCode, currentUserId, currentUserName, label, recurring, loadBlocks])

  const handleDeleteBlock = useCallback(async () => {
    if (selectedBlock && selectedBlock.userId === currentUserId) {
      await calendarState.removeBlock(groupCode, selectedBlock.id)
      // Reload blocks immediately after deleting
      await loadBlocks()
      setPopoverOpen(false)
      setSelectedBlock(null)
    }
  }, [selectedBlock, groupCode, currentUserId, loadBlocks])

  const handleManualInput = async () => {
    const blockData = {
      day: manualInput.day,
      startHour: manualInput.startHour,
      startMinute: manualInput.startMinute,
      endHour: manualInput.endHour,
      endMinute: manualInput.endMinute,
    }

    // Validate: end must be after start
    const startTotal = manualInput.startHour * 60 + manualInput.startMinute
    const endTotal = manualInput.endHour * 60 + manualInput.endMinute
    
    if (endTotal <= startTotal) {
      alert("End time must be after start time")
      return
    }

    await calendarState.addBlock({
      userId: currentUserId,
      userName: currentUserName,
      groupCode,
      day: blockData.day,
      startHour: blockData.startHour,
      startMinute: blockData.startMinute,
      endHour: blockData.endHour,
      endMinute: blockData.endMinute,
      label: label || "Busy",
      recurring,
    })

    await loadBlocks()
    setDialogOpen(false)
    setLabel("")
    setRecurring(false)
    setManualInput({
      day: 0,
      startHour: 9,
      startMinute: 0,
      endHour: 10,
      endMinute: 0,
    })
  }

  const getBlocksForDay = (dayIndex: number) => {
    return blocks.filter((block) => block.day === dayIndex)
  }

  const getBlockStyle = useCallback((block: BusyBlock) => {
    const top = getHourPosition(block.startHour, block.startMinute)
    const endPos = getHourPosition(block.endHour, block.endMinute)
    const height = endPos - top

    const isOwnBlock = block.userId === currentUserId
    const bgColor = isOwnBlock
      ? "bg-primary/20 border-primary/40"
      : "bg-muted/50 border-muted"

    return {
      top: `${top}px`,
      height: `${Math.max(height, 30)}px`,
      className: `${bgColor} border-l-2 absolute left-0 right-0 cursor-pointer hover:opacity-80 transition-opacity`,
    }
  }, [getHourPosition, currentUserId])

  const getDraggingStyle = () => {
    if (!dragging) return null

    const top = getHourPosition(dragging.startHour, dragging.startMinute)
    const height =
      getHourPosition(dragging.endHour, dragging.endMinute) -
      getHourPosition(dragging.startHour, dragging.startMinute)

    return {
      top: `${top}px`,
      height: `${Math.max(height, 30)}px`,
    }
  }

  const getFreeSlotStyle = (slot: FreeSlot) => {
    const top = getHourPosition(slot.startHour, slot.startMinute)
    const height =
      getHourPosition(slot.endHour, slot.endMinute) -
      getHourPosition(slot.startHour, slot.startMinute)

    return {
      top: `${top}px`,
      height: `${Math.max(height, 4)}px`,
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setWeekStart((prev) => addDays(prev, -7))
            }
          >
            ← Prev
          </Button>
          <span className="text-sm font-medium">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
          >
            Next →
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Event</DialogTitle>
                <DialogDescription>
                  Manually input event details
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-day">Day</Label>
                  <select
                    id="manual-day"
                    value={manualInput.day}
                    onChange={(e) => setManualInput({ ...manualInput, day: parseInt(e.target.value) })}
                    className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                  >
                    {DAYS.map((day, idx) => (
                      <option key={idx} value={idx}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="manual-start-hour" className="text-xs text-muted-foreground">Hour</Label>
                        <select
                          id="manual-start-hour"
                          value={manualInput.startHour}
                          onChange={(e) => setManualInput({ ...manualInput, startHour: parseInt(e.target.value) })}
                          className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                            <option key={hour} value={hour === 12 ? 0 : hour}>
                              {hour}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="manual-start-minute" className="text-xs text-muted-foreground">Minute</Label>
                        <select
                          id="manual-start-minute"
                          value={manualInput.startMinute}
                          onChange={(e) => setManualInput({ ...manualInput, startMinute: parseInt(e.target.value) })}
                          className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                        >
                          <option value={0}>00</option>
                          <option value={30}>30</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="manual-start-period" className="text-xs text-muted-foreground">AM/PM</Label>
                        <select
                          id="manual-start-period"
                          value={manualInput.startHour >= 12 ? "PM" : "AM"}
                          onChange={(e) => {
                            const isPM = e.target.value === "PM"
                            const currentHour12 = manualInput.startHour === 0 ? 12 : (manualInput.startHour > 12 ? manualInput.startHour - 12 : manualInput.startHour)
                            const newHour = isPM 
                              ? (currentHour12 === 12 ? 12 : currentHour12 + 12)
                              : (currentHour12 === 12 ? 0 : currentHour12)
                            setManualInput({ ...manualInput, startHour: newHour })
                          }}
                          className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="manual-end-hour" className="text-xs text-muted-foreground">Hour</Label>
                        <select
                          id="manual-end-hour"
                          value={manualInput.endHour === 0 ? 12 : (manualInput.endHour > 12 ? manualInput.endHour - 12 : manualInput.endHour)}
                          onChange={(e) => {
                            const selectedHour12 = parseInt(e.target.value)
                            const isPM = manualInput.endHour >= 12
                            const newHour = isPM 
                              ? (selectedHour12 === 12 ? 12 : selectedHour12 + 12)
                              : (selectedHour12 === 12 ? 0 : selectedHour12)
                            setManualInput({ ...manualInput, endHour: newHour })
                          }}
                          className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                            <option key={hour} value={hour}>
                              {hour}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="manual-end-minute" className="text-xs text-muted-foreground">Minute</Label>
                        <select
                          id="manual-end-minute"
                          value={manualInput.endMinute}
                          onChange={(e) => setManualInput({ ...manualInput, endMinute: parseInt(e.target.value) })}
                          className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                        >
                          <option value={0}>00</option>
                          <option value={30}>30</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="manual-end-period" className="text-xs text-muted-foreground">AM/PM</Label>
                        <select
                          id="manual-end-period"
                          value={manualInput.endHour >= 12 ? "PM" : "AM"}
                          onChange={(e) => {
                            const isPM = e.target.value === "PM"
                            const currentHour12 = manualInput.endHour === 0 ? 12 : (manualInput.endHour > 12 ? manualInput.endHour - 12 : manualInput.endHour)
                            const newHour = isPM 
                              ? (currentHour12 === 12 ? 12 : currentHour12 + 12)
                              : (currentHour12 === 12 ? 0 : currentHour12)
                            setManualInput({ ...manualInput, endHour: newHour })
                          }}
                          className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-label">Label</Label>
                  <Input
                    id="manual-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Work, School, etc."
                    className="font-mono"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="manual-recurring">Recurring Weekly</Label>
                  <Switch
                    id="manual-recurring"
                    checked={recurring}
                    onCheckedChange={setRecurring}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleManualInput}>
                  Add Event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Switch
            id="group-availability"
            checked={showGroupAvailability}
            onCheckedChange={setShowGroupAvailability}
          />
          <Label htmlFor="group-availability" className="text-sm cursor-pointer">
            Show Group Availability
          </Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Today
          </Button>
        </div>
      </div>

      <div
        ref={calendarRef}
        className="border rounded-sm overflow-hidden bg-card"
      >
        <div className="grid grid-cols-8 border-b">
          <div className="p-2 border-r"></div>
          {DAYS.map((day, index) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium border-r last:border-r-0"
            >
              <div>{day}</div>
              <div className="text-xs text-muted-foreground">
                {format(getDayDate(index), "d")}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-8 relative" style={{ gridAutoRows: 'min-content' }}>
          <div className="border-r">
            {!expandedMorning && (
              <div className="flex items-center justify-center border-b" style={{ height: `${HOUR_HEIGHT}px` }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedMorning(true)}
                  className="h-8 w-8 p-0"
                  title="Show morning hours (12am-5am)"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {expandedMorning && (
              <div className="flex items-center justify-center border-b" style={{ height: `${HOUR_HEIGHT}px` }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedMorning(false)}
                  className="h-8 w-8 p-0"
                  title="Hide morning hours"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            )}
            {visibleHours.map((hour) => (
              <div
                key={hour}
                className="border-b text-xs text-muted-foreground px-2 py-1"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {format(new Date().setHours(hour, 0), "h a")}
              </div>
            ))}
            {!expandedNight && (
              <div className="flex items-center justify-center border-b" style={{ height: `${HOUR_HEIGHT}px` }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedNight(true)}
                  className="h-8 w-8 p-0"
                  title="Show night hours (10pm-11pm)"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {expandedNight && (
              <div className="flex items-center justify-center border-b" style={{ height: `${HOUR_HEIGHT}px` }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedNight(false)}
                  className="h-8 w-8 p-0"
                  title="Hide night hours"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {DAYS.map((_, dayIndex) => (
            <div
              key={dayIndex}
              data-day={dayIndex}
              className="relative border-r last:border-r-0"
              style={{ minHeight: '100%' }}
              onMouseDown={(e) => handleMouseDown(e, dayIndex)}
              onMouseEnter={() => {
                if (draggingBlock) {
                  setDragTargetDay(dayIndex)
                }
              }}
              onMouseUp={async () => {
                if (draggingBlock && dragTargetDay !== null && draggingBlock.day !== dragTargetDay) {
                  // Duplicate block to new day
                  await calendarState.addBlock({
                    userId: currentUserId,
                    userName: currentUserName,
                    groupCode,
                    day: dragTargetDay,
                    startHour: draggingBlock.startHour,
                    startMinute: draggingBlock.startMinute,
                    endHour: draggingBlock.endHour,
                    endMinute: draggingBlock.endMinute,
                    label: draggingBlock.label,
                    recurring: draggingBlock.recurring,
                  })
                  await loadBlocks()
                  setDraggingBlock(null)
                  setDragTargetDay(null)
                }
              }}
            >
              {!expandedMorning && (
                <div className="border-b border-dashed border-border/50" style={{ height: `${HOUR_HEIGHT}px` }} />
              )}
              {expandedMorning && (
                <div className="border-b border-dashed border-border/50" style={{ height: `${HOUR_HEIGHT}px` }} />
              )}
              {visibleHours.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-dashed border-border/50"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                />
              ))}
              {!expandedNight && (
                <div className="border-b border-dashed border-border/50" style={{ height: `${HOUR_HEIGHT}px` }} />
              )}
              {expandedNight && (
                <div className="border-b border-dashed border-border/50" style={{ height: `${HOUR_HEIGHT}px` }} />
              )}

              {/* Free time overlay - render first so busy blocks appear on top */}
              {showGroupAvailability &&
                freeSlots
                  .filter((slot) => slot.day === dayIndex)
                  .map((slot, idx) => {
                    const style = getFreeSlotStyle(slot)
                    return (
                      <div
                        key={`free-${dayIndex}-${idx}`}
                        style={style}
                        className="bg-green-500/15 border-l-2 border-green-500/30 absolute left-0 right-0 pointer-events-none z-[1]"
                      />
                    )
                  })}

              {/* Existing blocks */}
              {getBlocksForDay(dayIndex).map((block) => {
                const style = getBlockStyle(block)
                const isDragging = draggingBlock?.id === block.id
                const isTargetDay = dragTargetDay === dayIndex && isDragging
                const isOwnBlock = block.userId === currentUserId
                
                return (
                  <Tooltip key={block.id}>
                    <TooltipTrigger asChild>
                      <div
                        style={{ 
                          top: style.top, 
                          height: style.height,
                          position: 'absolute',
                          left: 0,
                          right: 0,
                        }}
                        className={`${style.className} z-[2] ${isTargetDay ? 'ring-2 ring-primary' : ''} ${!isOwnBlock ? 'cursor-default' : 'cursor-pointer'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          // Only allow editing own blocks
                          if (!isOwnBlock) return
                          setSelectedBlock(block)
                          setLabel(block.label)
                          setRecurring(block.recurring)
                          setEditingBlock({
                            day: block.day,
                            startHour: block.startHour,
                            startMinute: block.startMinute,
                            endHour: block.endHour,
                            endMinute: block.endMinute,
                          })
                          setPopoverOpen(true)
                        }}
                        onMouseDown={(e) => {
                          // Only allow dragging own blocks
                          if (e.button === 0 && isOwnBlock) {
                            e.stopPropagation()
                            setDraggingBlock(block)
                          }
                        }}
                      >
                        <div className="p-1 text-xs">
                          <div className="font-medium truncate">{block.label}</div>
                          <div className="text-muted-foreground text-[10px]">
                            {block.userName}
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{block.userName}{!isOwnBlock ? ' (Read-only)' : ''}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
              
              {/* Preview block being dragged to this day */}
              {draggingBlock && dragTargetDay === dayIndex && draggingBlock.day !== dayIndex && (
                <div
                  style={{
                    top: getHourPosition(draggingBlock.startHour, draggingBlock.startMinute),
                    height: getHourPosition(draggingBlock.endHour, draggingBlock.endMinute) - getHourPosition(draggingBlock.startHour, draggingBlock.startMinute),
                  }}
                  className="bg-primary/30 border-l-2 border-primary absolute left-0 right-0 pointer-events-none z-[4] opacity-50"
                >
                  <div className="p-1 text-xs">
                    <div className="font-medium truncate">{draggingBlock.label}</div>
                    <div className="text-muted-foreground text-[10px]">Copy</div>
                  </div>
                </div>
              )}

              {/* Dragging preview */}
              {dragging && dragging.day === dayIndex && (
                <div
                  style={getDraggingStyle()!}
                  className="bg-primary/30 border-l-2 border-primary absolute left-0 right-0 pointer-events-none z-[3]"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button className="hidden" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">
                {selectedBlock ? "Edit Event" : "Mark as Busy"}
              </h4>
              {selectedBlock && selectedBlock.userId === currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleDeleteBlock}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {selectedBlock && selectedBlock.userId !== currentUserId && (
              <div className="text-sm text-muted-foreground pb-2 border-b">
                This event belongs to {selectedBlock.userName}. You can only edit your own events.
              </div>
            )}

            {selectedBlock && selectedBlock.userId === currentUserId && (
              <div className="space-y-4 pb-4 border-b">
                <div className="space-y-2">
                  <Label>Day</Label>
                  <select
                    value={editingBlock?.day ?? selectedBlock.day}
                    onChange={(e) => {
                      const newDay = parseInt(e.target.value)
                      setEditingBlock({
                        day: newDay,
                        startHour: editingBlock?.startHour ?? selectedBlock.startHour,
                        startMinute: editingBlock?.startMinute ?? selectedBlock.startMinute,
                        endHour: editingBlock?.endHour ?? selectedBlock.endHour,
                        endMinute: editingBlock?.endMinute ?? selectedBlock.endMinute,
                      })
                    }}
                    className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                  >
                    {DAYS.map((day, idx) => (
                      <option key={idx} value={idx}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Hour</Label>
                      <select
                        value={(editingBlock?.startHour ?? selectedBlock.startHour) === 0 ? 12 : ((editingBlock?.startHour ?? selectedBlock.startHour) > 12 ? (editingBlock?.startHour ?? selectedBlock.startHour) - 12 : (editingBlock?.startHour ?? selectedBlock.startHour))}
                        onChange={(e) => {
                          const selectedHour12 = parseInt(e.target.value)
                          const isPM = (editingBlock?.startHour ?? selectedBlock.startHour) >= 12
                          const newHour = isPM 
                            ? (selectedHour12 === 12 ? 12 : selectedHour12 + 12)
                            : (selectedHour12 === 12 ? 0 : selectedHour12)
                          setEditingBlock({
                            day: editingBlock?.day ?? selectedBlock.day,
                            startHour: newHour,
                            startMinute: editingBlock?.startMinute ?? selectedBlock.startMinute,
                            endHour: editingBlock?.endHour ?? selectedBlock.endHour,
                            endMinute: editingBlock?.endMinute ?? selectedBlock.endMinute,
                          })
                        }}
                        className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Minute</Label>
                      <select
                        value={editingBlock?.startMinute ?? selectedBlock.startMinute}
                        onChange={(e) => {
                          setEditingBlock({
                            day: editingBlock?.day ?? selectedBlock.day,
                            startHour: editingBlock?.startHour ?? selectedBlock.startHour,
                            startMinute: parseInt(e.target.value),
                            endHour: editingBlock?.endHour ?? selectedBlock.endHour,
                            endMinute: editingBlock?.endMinute ?? selectedBlock.endMinute,
                          })
                        }}
                        className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                      >
                        <option value={0}>00</option>
                        <option value={30}>30</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">AM/PM</Label>
                      <select
                        value={(editingBlock?.startHour ?? selectedBlock.startHour) >= 12 ? "PM" : "AM"}
                        onChange={(e) => {
                          const isPM = e.target.value === "PM"
                          const currentHour12 = (editingBlock?.startHour ?? selectedBlock.startHour) === 0 ? 12 : ((editingBlock?.startHour ?? selectedBlock.startHour) > 12 ? (editingBlock?.startHour ?? selectedBlock.startHour) - 12 : (editingBlock?.startHour ?? selectedBlock.startHour))
                          const newHour = isPM 
                            ? (currentHour12 === 12 ? 12 : currentHour12 + 12)
                            : (currentHour12 === 12 ? 0 : currentHour12)
                          setEditingBlock({
                            day: editingBlock?.day ?? selectedBlock.day,
                            startHour: newHour,
                            startMinute: editingBlock?.startMinute ?? selectedBlock.startMinute,
                            endHour: editingBlock?.endHour ?? selectedBlock.endHour,
                            endMinute: editingBlock?.endMinute ?? selectedBlock.endMinute,
                          })
                        }}
                        className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>End Time</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Hour</Label>
                      <select
                        value={(editingBlock?.endHour ?? selectedBlock.endHour) === 0 ? 12 : ((editingBlock?.endHour ?? selectedBlock.endHour) > 12 ? (editingBlock?.endHour ?? selectedBlock.endHour) - 12 : (editingBlock?.endHour ?? selectedBlock.endHour))}
                        onChange={(e) => {
                          const selectedHour12 = parseInt(e.target.value)
                          const isPM = (editingBlock?.endHour ?? selectedBlock.endHour) >= 12
                          const newHour = isPM 
                            ? (selectedHour12 === 12 ? 12 : selectedHour12 + 12)
                            : (selectedHour12 === 12 ? 0 : selectedHour12)
                          setEditingBlock({
                            day: editingBlock?.day ?? selectedBlock.day,
                            startHour: editingBlock?.startHour ?? selectedBlock.startHour,
                            startMinute: editingBlock?.startMinute ?? selectedBlock.startMinute,
                            endHour: newHour,
                            endMinute: editingBlock?.endMinute ?? selectedBlock.endMinute,
                          })
                        }}
                        className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Minute</Label>
                      <select
                        value={editingBlock?.endMinute ?? selectedBlock.endMinute}
                        onChange={(e) => {
                          setEditingBlock({
                            day: editingBlock?.day ?? selectedBlock.day,
                            startHour: editingBlock?.startHour ?? selectedBlock.startHour,
                            startMinute: editingBlock?.startMinute ?? selectedBlock.startMinute,
                            endHour: editingBlock?.endHour ?? selectedBlock.endHour,
                            endMinute: parseInt(e.target.value),
                          })
                        }}
                        className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                      >
                        <option value={0}>00</option>
                        <option value={30}>30</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">AM/PM</Label>
                      <select
                        value={(editingBlock?.endHour ?? selectedBlock.endHour) >= 12 ? "PM" : "AM"}
                        onChange={(e) => {
                          const isPM = e.target.value === "PM"
                          const currentHour12 = (editingBlock?.endHour ?? selectedBlock.endHour) === 0 ? 12 : ((editingBlock?.endHour ?? selectedBlock.endHour) > 12 ? (editingBlock?.endHour ?? selectedBlock.endHour) - 12 : (editingBlock?.endHour ?? selectedBlock.endHour))
                          const newHour = isPM 
                            ? (currentHour12 === 12 ? 12 : currentHour12 + 12)
                            : (currentHour12 === 12 ? 0 : currentHour12)
                          setEditingBlock({
                            day: editingBlock?.day ?? selectedBlock.day,
                            startHour: editingBlock?.startHour ?? selectedBlock.startHour,
                            startMinute: editingBlock?.startMinute ?? selectedBlock.startMinute,
                            endHour: newHour,
                            endMinute: editingBlock?.endMinute ?? selectedBlock.endMinute,
                          })
                        }}
                        className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-mono"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Work, School, etc."
                autoFocus={!selectedBlock}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveBlock()
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="recurring">Recurring Weekly</Label>
              <Switch
                id="recurring"
                checked={recurring}
                onCheckedChange={setRecurring}
              />
            </div>

            <div className="flex gap-2">
              {(!selectedBlock || selectedBlock.userId === currentUserId) && (
                <Button onClick={handleSaveBlock} className="flex-1">
                  Save
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setPopoverOpen(false)
                  setSelectedBlock(null)
                  setPendingDrag(null)
                  setEditingBlock(null)
                }}
                className={(!selectedBlock || selectedBlock.userId === currentUserId) ? "" : "flex-1"}
              >
                {(!selectedBlock || selectedBlock.userId === currentUserId) ? "Cancel" : "Close"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      </div>
    </TooltipProvider>
  )
}

