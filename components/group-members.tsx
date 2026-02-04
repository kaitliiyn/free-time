"use client"

import { useState, useEffect } from "react"
import { Users } from "lucide-react"
import { groupState, type GroupMember } from "@/lib/group-state"

interface GroupMembersProps {
  groupCode: string
  currentUserId: string
}

export function GroupMembers({ groupCode, currentUserId }: GroupMembersProps) {
  const [members, setMembers] = useState<GroupMember[]>([])

  useEffect(() => {
    const loadMembers = async () => {
      const groupMembers = await groupState.getGroupMembers(groupCode)
      setMembers(groupMembers)
    }

    loadMembers()

    // Subscribe to real-time updates
    const unsubscribe = groupState.subscribeToMembers(groupCode, (updatedMembers) => {
      setMembers(updatedMembers)
    })

    return () => {
      unsubscribe()
    }
  }, [groupCode])

  if (members.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg">
        <Users className="h-5 w-5" />
        <h2 className="font-semibold">Group Members</h2>
        <span className="text-sm text-muted-foreground">({members.length})</span>
      </div>

      <div className="grid gap-3">
        {members.map((member) => {
          const isCurrentUser = member.userId === currentUserId
          return (
            <div
              key={member.userId}
              className={`border rounded-sm p-3 bg-card hover:bg-accent/50 transition-colors ${
                isCurrentUser ? "border-primary/40" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold ${
                    isCurrentUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/20 text-primary"
                  }`}
                >
                  {member.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium">
                    {member.userName}
                    {isCurrentUser && (
                      <span className="text-xs text-muted-foreground ml-2">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

