"use client"

import { useState, useEffect } from "react"
import { Calendar as CalendarIcon, Share2, Check } from "lucide-react"
import { Calendar } from "@/components/calendar"
import { FreeSlotsSidebar } from "@/components/free-slots-sidebar"
import { GroupMembers } from "@/components/group-members"
import { type FreeSlot } from "@/lib/free-time-calculator"
import { startOfWeek } from "date-fns"
import { Button } from "@/components/ui/button"
import { groupState, type GroupMember } from "@/lib/group-state"

interface DashboardProps {
  userName: string
  userId: string
  groupCode: string
}

export function Dashboard({ userName, userId, groupCode }: DashboardProps) {
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([])
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    return startOfWeek(today, { weekStartsOn: 1 })
  })
  const [linkCopied, setLinkCopied] = useState(false)
  const [memberCount, setMemberCount] = useState(0)

  // Ensure user is in the group
  useEffect(() => {
    const ensureMembership = async () => {
      await groupState.joinGroup(groupCode, userId, userName)
    }
    ensureMembership()
  }, [groupCode, userId, userName])

  // Load member count
  useEffect(() => {
    const loadMemberCount = async () => {
      const members = await groupState.getGroupMembers(groupCode)
      setMemberCount(members.length)
    }

    loadMemberCount()

    // Subscribe to member updates
    const unsubscribe = groupState.subscribeToMembers(groupCode, (members) => {
      setMemberCount(members.length)
    })

    return () => {
      unsubscribe()
    }
  }, [groupCode])

  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy link:", err)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 p-8 overflow-y-auto min-w-0">
        <div className="container max-w-7xl mx-auto space-y-8">
          <header className="text-center mb-12 relative">
            <div className="absolute top-0 right-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareLink}
                className="gap-2"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    Share Link
                  </>
                )}
              </Button>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-2">
              Free Time
            </h1>
            <p className="text-muted-foreground">
              Welcome, {userName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Group: {groupCode}
            </p>
          </header>

          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 text-lg mb-4">
                <CalendarIcon className="h-5 w-5" />
                <h2 className="font-semibold">Weekly Calendar</h2>
              </div>
              <Calendar
                currentUserId={userId}
                currentUserName={userName}
                groupCode={groupCode}
                freeSlots={freeSlots}
                onFreeSlotsChange={setFreeSlots}
                onWeekStartChange={setWeekStart}
              />
            </div>

            <GroupMembers groupCode={groupCode} currentUserId={userId} />

          </div>
        </div>
      </div>
      <FreeSlotsSidebar 
        freeSlots={freeSlots} 
        weekStart={weekStart} 
        memberCount={memberCount}
        groupCode={groupCode}
      />
    </div>
  )
}

