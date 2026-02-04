"use client"

import { useState, useEffect } from "react"
import { Calendar as CalendarIcon, Share2, Check, AlertCircle, X } from "lucide-react"
import { Calendar } from "@/components/calendar"
import { FreeSlotsSidebar } from "@/components/free-slots-sidebar"
import { GroupMembers } from "@/components/group-members"
import { type FreeSlot } from "@/lib/free-time-calculator"
import { startOfWeek } from "date-fns"
import { Button } from "@/components/ui/button"
import { groupState, type GroupMember } from "@/lib/group-state"
import { isSupabaseConfigured } from "@/lib/supabase"

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
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  const [supabaseConfigured, setSupabaseConfigured] = useState(true)

  useEffect(() => {
    setSupabaseConfigured(isSupabaseConfigured())
  }, [])

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
        <div className="container max-w-7xl mx-auto space-y-8">
          {!supabaseConfigured && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-sm p-4 mb-4">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Supabase Not Configured</p>
                  <p className="text-sm text-muted-foreground">
                    Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables in Netlify.
                  </p>
                </div>
              </div>
            </div>
          )}
          <header className="text-center mb-8 md:mb-12 relative">
            <div className="absolute top-0 right-0 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="gap-2 md:hidden"
              >
                Free Slots
              </Button>
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
                    <span className="hidden sm:inline">Share Link</span>
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
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        md:translate-x-0
        fixed md:relative
        top-0 right-0
        w-80 max-w-[85vw]
        h-screen
        bg-card
        border-l
        z-50
        transition-transform
        duration-300
        ease-in-out
        overflow-y-auto
        shadow-lg md:shadow-none
      `}>
        <div className="md:hidden p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Common Free Slots</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <FreeSlotsSidebar 
          freeSlots={freeSlots} 
          weekStart={weekStart} 
          memberCount={memberCount}
          groupCode={groupCode}
        />
      </div>
    </div>
  )
}

