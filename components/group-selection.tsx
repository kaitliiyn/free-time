"use client"

import { useState } from "react"
import { Users, Plus, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { groupState } from "@/lib/group-state"

interface GroupSelectionProps {
  userName: string
  userId: string
  onGroupSelected: (groupCode: string) => void
}

function generateGroupCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let code = ""
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)]
  }
  return code
}

export function GroupSelection({ userName, userId, onGroupSelected }: GroupSelectionProps) {
  const [groupCode, setGroupCode] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [mode, setMode] = useState<"select" | "create" | "join">("select")

  const handleCreateGroup = () => {
    const code = generateGroupCode()
    setGroupCode(code)
    setMode("create")
  }

  const handleStartGroup = async () => {
    if (groupCode) {
      // Create group and add creator
      await groupState.createGroup(groupCode, userId, userName)
      onGroupSelected(groupCode)
    }
  }

  const handleJoinGroup = async () => {
    if (joinCode.trim().length === 4) {
      const code = joinCode.trim().toUpperCase()
      // Join group
      await groupState.joinGroup(code, userId, userName)
      onGroupSelected(code)
    }
  }

  if (mode === "create") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="container max-w-md mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Free Time
          </h1>
          
          <div className="space-y-4">
            <div className="p-6 border rounded-sm bg-card">
              <p className="text-sm text-muted-foreground mb-2">Your Group Code</p>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <p className="text-3xl font-mono font-bold tracking-wider">
                  {groupCode}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this code with your friends to join your group
              </p>
            </div>

            <Button
              onClick={handleStartGroup}
              size="lg"
              className="w-full h-12 text-base"
            >
              Start Group
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setMode("select")
                setGroupCode("")
              }}
              className="w-full"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === "join") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="container max-w-md mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Free Time
          </h1>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="join-code" className="text-sm">
                Enter Group Code
              </Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="join-code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "")
                    if (value.length <= 4) {
                      setJoinCode(value)
                    }
                  }}
                  placeholder="ABCD"
                  className="pl-10 h-12 text-base font-mono text-center text-2xl tracking-wider"
                  maxLength={4}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Ask your friend for their 4-letter group code
              </p>
            </div>

            <Button
              onClick={handleJoinGroup}
              size="lg"
              className="w-full h-12 text-base"
              disabled={joinCode.length !== 4}
            >
              Join Group
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setMode("select")
                setJoinCode("")
              }}
              className="w-full"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="container max-w-md mx-auto text-center space-y-8">
        <h1 className="text-4xl md:text-6xl font-bold mb-2">
          Free Time
        </h1>
        <p className="text-muted-foreground mb-8">
          Welcome, {userName}
        </p>

        <div className="space-y-4">
          <Button
            onClick={handleCreateGroup}
            size="lg"
            className="w-full h-14 text-base gap-3"
          >
            <Plus className="h-5 w-5" />
            Start a Group
          </Button>

          <Button
            onClick={() => setMode("join")}
            variant="outline"
            size="lg"
            className="w-full h-14 text-base gap-3"
          >
            <Users className="h-5 w-5" />
            Join Existing Group
          </Button>
        </div>
      </div>
    </div>
  )
}

