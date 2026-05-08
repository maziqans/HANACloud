"use client"

import { Search } from "lucide-react"

interface SearchBarProps {
  value?: string
  onChange?: (value: string) => void
}

export function SearchBar({ value = "", onChange }: SearchBarProps) {
  return (
    <div className="relative flex items-center w-full max-w-xl search-focus transition-all duration-200 rounded-xl">
      <div className="absolute left-4 pointer-events-none">
        <Search className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Search files and folders..."
        className="w-full bg-card border border-border rounded-xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all duration-200"
      />
    </div>
  )
}
