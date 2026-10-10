import { openDB, type DBSchema } from "idb"
import { classifyComplaint } from "./classifier"
import type { ActivityEvent, Complaint, ComplaintInput } from "../types"

interface MetroCareDB extends DBSchema {
  complaints: {
    key: string
    value: Complaint
    indexes: {
      "by-created": string
      "by-sync": string
    }
  }
  settings: {
    key: string
    value: {
      key: string
      value: unknown
    }
  }
  syncMetadata: {
    key: string
    value: {
      id: string
      lastAttempt: string
      result: string
    }
  }
}

const dbPromise = openDB<MetroCareDB>("metrocare-db", 1, {
  upgrade(db) {
    const complaints = db.createObjectStore("complaints", { keyPath: "id" })
    complaints.createIndex("by-created", "createdAt")
    complaints.createIndex("by-sync", "syncStatus")
    db.createObjectStore("settings", { keyPath: "key" })
    db.createObjectStore("syncMetadata", { keyPath: "id" })
  },
})

const seedItems = [
  [
    "સફાઈ નથી, પ્લેટફોર્મ પર કચરો છે",
    "Motera Stadium",
    "Cleanliness",
    "Resolved",
    "Low",
    "Kavita P.",
  ],
  [
    "Someone is behaving suspiciously near gate 2",
    "Vastral Gam",
    "Safety",
    "Open",
    "High",
    "Unassigned",
  ],
  [
    "Ticket payment deducted but ticket not generated",
    "Sabarmati",
    "Fare and Ticketing",
    "In Progress",
    "Medium",
    "Rohan S.",
  ],
  ["ट्रेन में बहुत भीड़ है", "Amdavad", "Crowding", "Open", "Medium", "Mehul D."],
  [
    "Lift not working at platform level",
    "Gandhinagar Capital",
    "Escalator and Lift",
    "Open",
    "Medium",
    "Unassigned",
  ],
] as const

export async function seedDatabase() {
  const db = await dbPromise
  const marker = await db.get("settings", "seeded")
  if (marker) return
  const now = Date.now()
  const tx = db.transaction(["complaints", "settings"], "readwrite")
  for (const [
    description,
    station,
    selected,
    status,
    priority,
    assignedTo,
  ] of seedItems) {
    const index = seedItems.findIndex((item) => item[0] === description)
    const classification = classifyComplaint(description, selected)
    const createdAt = new Date(now - (index + 1) * 1000 * 60 * 78).toISOString()
    await tx.objectStore("complaints").put({
      id: `MC-DEMO-${String(index + 1).padStart(3, "0")}`,
      description,
      station,
      category: selected,
      department: classification.department,
      priority,
      status,
      language: index === 0 ? "ગુજરાતી" : index === 3 ? "हिन्दी" : "English",
      createdAt,
      updatedAt: createdAt,
      resolvedAt:
        status === "Resolved"
          ? new Date(now - 1000 * 60 * 30).toISOString()
          : undefined,
      assignedTo,
      syncStatus: "synced",
      syncAttempts: 0,
      classification: { ...classification, category: selected, priority },
      resolutionNotes:
        status === "Resolved"
          ? "Housekeeping team inspected and cleared the area."
          : "",
      archived: false,
      isDemo: true,
    })
  }
  await tx.objectStore("settings").put({ key: "seeded", value: true })
  await tx.done
}

export async function getComplaints() {
  const db = await dbPromise
  const items = await db.getAllFromIndex("complaints", "by-created")
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getLastSavedAt() {
  const db = await dbPromise
  const saved = await db.get("settings", "lastSavedAt")
  return typeof saved?.value === "string" ? saved.value : undefined
}

export async function getSyncMetadata() {
  const db = await dbPromise
  return db.getAll("syncMetadata")
}

export function createId() {
  const time = Date.now().toString(36).toUpperCase()
  const random = crypto
    .getRandomValues(new Uint16Array(1))[0]
    .toString(36)
    .toUpperCase()
    .padStart(3, "0")
  return `MC-${time}-${random}`
}

export async function addComplaint(
  input: ComplaintInput,
  classification: Complaint["classification"],
) {
  const db = await dbPromise
  const now = new Date().toISOString()
  const item: Complaint = {
    ...input,
    id: createId(),
    category: classification.category,
    department: classification.department,
    priority: classification.priority,
    status: "Open",
    createdAt: now,
    updatedAt: now,
    assignedTo: "Unassigned",
    syncStatus: "pending",
    syncAttempts: 0,
    classification,
    resolutionNotes: "",
    archived: false,
    isDemo: false,
    activity: [
      {
        id: crypto.randomUUID(),
        type: "submitted",
        message: "Complaint submitted and saved locally.",
        at: now,
        actor: "Operations staff",
      },
    ],
  }
  const tx = db.transaction(["complaints", "settings"], "readwrite")
  await tx.objectStore("complaints").put(item)
  await tx.objectStore("settings").put({ key: "lastSavedAt", value: now })
  await tx.done
  return item
}

function activityForChange(
  current: Complaint,
  changes: Partial<Complaint>,
  at: string,
): ActivityEvent | undefined {
  let type: ActivityEvent["type"] | undefined
  let message = ""
  if (changes.assignedTo && changes.assignedTo !== current.assignedTo) {
    type = "assigned"
    message = `Assigned to ${changes.assignedTo}.`
  } else if (changes.status && changes.status !== current.status) {
    type = changes.status === "Resolved" ? "resolved" : "status"
    message = `Status changed from ${current.status} to ${changes.status}.`
  } else if (
    changes.resolutionNotes !== undefined &&
    changes.resolutionNotes !== current.resolutionNotes
  ) {
    type = "note"
    message = "Internal or resolution notes updated."
  } else if (changes.category || changes.priority || changes.department) {
    type = "classification"
    message = "Classification was manually corrected by staff."
  } else if (changes.reply || changes.replyDrafts) {
    type = "reply"
    message = "A multilingual reply draft was saved or reviewed."
  } else if (
    changes.incidentId !== undefined &&
    changes.incidentId !== current.incidentId
  ) {
    type = "incident"
    message = changes.incidentId
      ? `Linked to incident ${changes.incidentId}.`
      : "Removed from linked incident."
  }
  return type
    ? { id: crypto.randomUUID(), type, message, at, actor: "Operations staff" }
    : undefined
}

export async function updateComplaint(id: string, changes: Partial<Complaint>) {
  const db = await dbPromise
  const current = await db.get("complaints", id)
  if (!current) throw new Error("Complaint not found")
  const at = new Date().toISOString()
  const event = activityForChange(current, changes, at)
  const updated: Complaint = {
    ...current,
    ...changes,
    updatedAt: at,
    syncStatus: "pending",
    activity: event ? [...(current.activity ?? []), event] : current.activity,
  }
  if (updated.status === "Resolved" && !updated.resolvedAt)
    updated.resolvedAt = new Date().toISOString()
  if (updated.status !== "Resolved") updated.resolvedAt = undefined
  const tx = db.transaction(["complaints", "settings"], "readwrite")
  await tx.objectStore("complaints").put(updated)
  await tx.objectStore("settings").put({ key: "lastSavedAt", value: at })
  await tx.done
  return updated
}

export async function removeComplaint(id: string) {
  const db = await dbPromise
  const at = new Date().toISOString()
  const tx = db.transaction(["complaints", "settings"], "readwrite")
  await tx.objectStore("complaints").delete(id)
  await tx.objectStore("settings").put({ key: "lastSavedAt", value: at })
  await tx.done
}

export async function linkComplaintsToIncident(ids: string[]) {
  const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`
  for (const id of ids) await updateComplaint(id, { incidentId })
  return incidentId
}

export async function markSynced(ids: string[]) {
  const db = await dbPromise
  const tx = db.transaction(
    ["complaints", "syncMetadata", "settings"],
    "readwrite",
  )
  const at = new Date().toISOString()
  for (const id of ids) {
    const item = await tx.objectStore("complaints").get(id)
    if (!item || item.syncStatus === "synced") continue
    await tx.objectStore("complaints").put({
      ...item,
      syncStatus: "synced",
      syncAttempts: item.syncAttempts + 1,
      updatedAt: at,
    })
    await tx
      .objectStore("syncMetadata")
      .put({ id, lastAttempt: at, result: "simulated-local-sync" })
  }
  await tx.objectStore("settings").put({ key: "lastSavedAt", value: at })
  await tx.objectStore("settings").put({ key: "lastSyncAt", value: at })
  await tx.done
}
