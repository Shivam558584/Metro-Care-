import { getComplaints, markSynced } from "./database"

export async function runDemoSync(onlyIds?: string[]) {
  const complaints = await getComplaints()
  const pending = complaints
    .filter(
      (item) =>
        (item.syncStatus === "pending" || item.syncStatus === "failed") &&
        (!onlyIds || onlyIds.includes(item.id)),
    )
    .map((item) => item.id)
  if (!pending.length) return 0
  await new Promise((resolve) => setTimeout(resolve, 650))
  await markSynced(pending)
  return pending.length
}
