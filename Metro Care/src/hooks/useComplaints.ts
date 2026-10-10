import { useCallback, useEffect, useState } from "react"
import { getComplaints, getLastSavedAt, seedDatabase } from "../lib/database"
import type { Complaint } from "../types"

export function useComplaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastSavedAt, setLastSavedAt] = useState<string>()

  const refresh = useCallback(async () => {
    try {
      setError("")
      const [items, savedAt] = await Promise.all([
        getComplaints(),
        getLastSavedAt(),
      ])
      setComplaints(items)
      setLastSavedAt(savedAt)
    } catch {
      setError(
        "Local storage could not be read. Check browser storage permissions.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    seedDatabase()
      .then(refresh)
      .catch(() => {
        setError("MetroCare could not initialise offline storage.")
        setLoading(false)
      })
  }, [refresh])

  return { complaints, loading, error, refresh, lastSavedAt }
}
