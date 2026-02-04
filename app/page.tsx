"use client"

import { useState, useEffect } from "react"
import { Landing } from "@/components/landing"
import { GroupSelection } from "@/components/group-selection"
import { Dashboard } from "@/components/dashboard"

const STORAGE_KEY = "free-time-user-name"
const USER_ID_KEY = "free-time-user-id"
const GROUP_CODE_KEY = "free-time-group-code"

function generateUserId(name: string): string {
  // Simple hash function to generate a consistent ID from name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `user-${Math.abs(hash)}`
}

export default function Home() {
  const [userName, setUserName] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [groupCode, setGroupCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check localStorage on mount
    const storedName = localStorage.getItem(STORAGE_KEY)
    const storedUserId = localStorage.getItem(USER_ID_KEY)
    const storedGroupCode = localStorage.getItem(GROUP_CODE_KEY)
    if (storedName) {
      setUserName(storedName)
      setUserId(storedUserId || generateUserId(storedName))
      if (storedGroupCode) {
        setGroupCode(storedGroupCode)
      }
    }
    setIsLoading(false)
  }, [])

  const handleJoin = (name: string) => {
    const id = generateUserId(name)
    setUserName(name)
    setUserId(id)
    localStorage.setItem(STORAGE_KEY, name)
    localStorage.setItem(USER_ID_KEY, id)
  }

  const handleGroupSelected = (code: string) => {
    setGroupCode(code)
    localStorage.setItem(GROUP_CODE_KEY, code)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!userName || !userId) {
    return <Landing onJoin={handleJoin} />
  }

  if (!groupCode) {
    return <GroupSelection userName={userName} userId={userId} onGroupSelected={handleGroupSelected} />
  }

  return <Dashboard userName={userName} userId={userId} groupCode={groupCode} />
}
