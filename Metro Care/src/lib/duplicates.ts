import type { Complaint } from "../types"

const stopWords = new Set([
  "the",
  "is",
  "at",
  "a",
  "an",
  "and",
  "in",
  "on",
  "near",
  "very",
  "not",
  "છે",
  "पर",
  "है",
])

function tokens(value: string) {
  return new Set(
    value
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !stopWords.has(token)),
  )
}

export function descriptionSimilarity(first: string, second: string) {
  const a = tokens(first)
  const b = tokens(second)
  if (!a.size || !b.size) return 0
  const overlap = [...a].filter((token) => b.has(token)).length
  return overlap / new Set([...a, ...b]).size
}

export function findPossibleDuplicates(
  complaint: Complaint,
  complaints: Complaint[],
) {
  return complaints
    .filter(
      (candidate) =>
        candidate.id !== complaint.id &&
        !candidate.archived &&
        candidate.station === complaint.station &&
        candidate.category === complaint.category,
    )
    .map((candidate) => ({
      complaint: candidate,
      similarity: descriptionSimilarity(
        complaint.description,
        candidate.description,
      ),
    }))
    .filter((match) => match.similarity >= 0.18)
    .sort((a, b) => b.similarity - a.similarity)
}
