"use client"

import { useState, useEffect, useCallback } from "react"
import * as api from "@/lib/api"

export function useStorageSummary() {
  const [storageInfo, setStorageInfo] = useState({
    used_bytes: 0,
    total_bytes: 50 * 1024 * 1024 * 1024,
    breakdown: { videos: 0, images: 0, documents: 0, others: 0 }
  })
  const [isLoading, setIsLoading] = useState(true)

  const fetchStorage = useCallback(async () => {
    try {
      const data = await api.getStorageInfo()
      setStorageInfo(data)
    } catch (error) {
      console.error("Failed to fetch storage info", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStorage()
    window.addEventListener("storageUpdated", fetchStorage)
    return () => window.removeEventListener("storageUpdated", fetchStorage)
  }, [fetchStorage])

  return { storageInfo, isLoading, refetch: fetchStorage }
}