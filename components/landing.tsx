"use client"

import { useState, FormEvent } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"

interface LandingProps {
  onJoin: (name: string) => void
}

export function Landing({ onJoin }: LandingProps) {
  const [name, setName] = useState("")

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onJoin(name.trim())
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="container max-w-md mx-auto text-center space-y-8">
        <h1 className="text-4xl md:text-6xl font-bold mb-8">
          Free Time
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm text-muted-foreground block">
              Enter your name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="pl-10 h-12 text-base"
                autoFocus
              />
            </div>
          </div>
          
          <Button
            type="submit"
            size="lg"
            className="w-full h-12 text-base"
            disabled={!name.trim()}
          >
            Join
          </Button>
        </form>
      </div>
    </div>
  )
}

