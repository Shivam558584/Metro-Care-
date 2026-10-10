export const CATEGORIES = [
  "Safety",
  "Cleanliness",
  "Fare and Ticketing",
  "Escalator and Lift",
  "Crowding",
  "Staff Behaviour",
  "Train Service",
  "Other",
] as const

export const STATIONS = [
  "Motera Stadium",
  "Vastral Gam",
  "Sabarmati",
  "Old High Court",
  "Kalupur Railway Station",
  "Amdavad",
  "Gandhinagar Capital",
] as const

export type Category = typeof CATEGORIES[number]
export type Priority = "Critical" | "High" | "Medium" | "Low"
export type Status = "Open" | "In Progress" | "Resolved"
export type SyncStatus = "pending" | "synced" | "failed"
export type ReplyLanguage = "English" | "ગુજરાતી" | "हिन्दी"

export interface Classification {
  category: Category
  department: string
  priority: Priority
  confidence: number
  explanation: string
  action: string
  needsReview: boolean
  matchedRules?: string[]
}

export interface SavedReply {
  language: ReplyLanguage
  body: string
  reviewed: boolean
  updatedAt: string
}

export interface ActivityEvent {
  id: string
  type: "submitted" | "assigned" | "status" | "note" | "classification" | "reply" | "incident" | "resolved"
  message: string
  at: string
  actor: string
}

export interface Complaint {
  id: string
  description: string
  station: string
  category: Category
  department: string
  priority: Priority
  status: Status
  language: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  assignedTo: string
  syncStatus: SyncStatus
  syncAttempts: number
  lastSyncError?: string
  classification: Classification
  resolutionNotes: string
  archived: boolean
  isDemo: boolean
  photo?: string
  reply?: SavedReply
  replyDrafts?: Partial<Record<ReplyLanguage, SavedReply>>
  activity?: ActivityEvent[]
  incidentId?: string
}

export type ComplaintInput = Pick<Complaint, "description" | "station" | "category" | "language" | "photo">
