import type { Category, Classification, Priority } from "../types"

interface Rule {
  category: Category
  department: string
  words: string[]
}

const rules: Rule[] = [
  {
    category: "Safety",
    department: "Safety & Security",
    words: [
      "fire",
      "smoke",
      "danger",
      "attack",
      "fight",
      "weapon",
      "suspicious",
      "accident",
      "medical",
      "unconscious",
      "harassment",
      "emergency",
      "unsafe",
      "electric shock",
      "fall",
      "collapsed",
      "આગ",
      "ધુમાડો",
      "ખતરો",
      "મદદ",
      "मारपीट",
      "आग",
      "धुआं",
      "खतरा",
      "बेहोश",
      "आपातकाल",
      "suraksha",
      "bachao",
      "madad",
      "aag",
      "dhumado",
    ],
  },
  {
    category: "Cleanliness",
    department: "Housekeeping",
    words: [
      "dirty",
      "clean",
      "garbage",
      "smell",
      "washroom",
      "સફાઈ",
      "કચરો",
      "ગંદુ",
      "सफाई",
      "गंदा",
      "कचरा",
      "badbu",
      "gandagi",
      "safai nathi",
      "kachro",
    ],
  },
  {
    category: "Fare and Ticketing",
    department: "Revenue & Ticketing",
    words: [
      "ticket",
      "fare",
      "payment",
      "deducted",
      "refund",
      "card",
      "token",
      "ટિકિટ",
      "પૈસા",
      "भुगतान",
      "टिकट",
      "पैसे",
      "kiraya",
      "paisa kat gaya",
      "payment thai gayu",
      "ticket nathi",
    ],
  },
  {
    category: "Escalator and Lift",
    department: "Station Maintenance",
    words: [
      "lift",
      "elevator",
      "escalator",
      "working",
      "stuck",
      "લિફ્ટ",
      "એસ્કેલેટર",
      "ચાલતી નથી",
      "लिफ्ट",
      "एस्केलेटर",
      "बंद",
      "kaam nahi",
      "chalu nathi",
      "fas gaya",
    ],
  },
  {
    category: "Crowding",
    department: "Station Operations",
    words: [
      "crowd",
      "crowded",
      "rush",
      "queue",
      "overcrowd",
      "ભીડ",
      "भीड़",
      "bheed",
      "bahu bhid",
    ],
  },
  {
    category: "Staff Behaviour",
    department: "Customer Experience",
    words: [
      "staff",
      "rude",
      "behaviour",
      "guard",
      "કર્મચારી",
      "વર્તન",
      "स्टाफ",
      "कर्मचारी",
      "बदतमीजी",
      "rude staff",
      "kharab vartan",
    ],
  },
  {
    category: "Train Service",
    department: "Train Operations",
    words: [
      "train",
      "delay",
      "late",
      "cancelled",
      "door",
      "service",
      "ટ્રેન",
      "મોડી",
      "ट्रेन",
      "देरी",
      "लेट",
      "train nathi",
      "modi chhe",
      "deri",
    ],
  },
]

const criticalWords = [
  "fire",
  "smoke",
  "weapon",
  "attack",
  "medical",
  "unconscious",
  "આગ",
  "ધુમાડો",
  "હથિયાર",
  "मारपीट",
  "आग",
  "धुआं",
  "बेहोश",
  "आपातकाल",
  "electric shock",
  "collapsed",
  "bachao",
  "aag",
]
const highWords = [
  "danger",
  "suspicious",
  "fight",
  "harassment",
  "accident",
  "stuck",
  "ખતરો",
  "ખતરનાક",
  "खतरा",
  "संदिग्ध",
  "फंसा",
  "unsafe",
  "fall",
  "fas gaya",
]

export function departmentFor(category: Category) {
  return (
    rules.find((rule) => rule.category === category)?.department ??
    "Customer Experience"
  )
}

export function classifyComplaint(
  text: string,
  selected?: Category,
): Classification {
  const normalized = text.toLocaleLowerCase()
  const matches = rules
    .map((rule) => ({
      rule,
      count: rule.words.filter((word) => normalized.includes(word)).length,
    }))
    .sort((a, b) => b.count - a.count)
  const winner = matches[0]
  const matchedRules = winner?.rule.words.filter((word) =>
    normalized.includes(word),
  )
  const category = winner?.count ? winner.rule.category : (selected ?? "Other")
  const department = departmentFor(category)
  const critical = criticalWords.some((word) => normalized.includes(word))
  const high =
    highWords.some((word) => normalized.includes(word)) ||
    (category === "Safety" && !critical)
  const priority: Priority = critical
    ? "Critical"
    : high
      ? "High"
      : winner?.count && winner.count > 1
        ? "Medium"
        : "Low"
  const confidence = winner?.count ? Math.min(96, 54 + winner.count * 14) : 32
  const needsReview = confidence < 60 || category === "Safety"
  return {
    category,
    department,
    priority,
    confidence,
    needsReview,
    matchedRules,
    explanation: winner?.count
      ? `Matched local ${category.toLowerCase()} rule${
          winner.count === 1 ? "" : "s"
        }: ${matchedRules?.map((term) => `“${term}”`).join(", ")}.`
      : "No strong keyword match; the selected category was retained.",
    action:
      priority === "Critical"
        ? "Alert the station controller immediately and begin the safety protocol."
        : category === "Safety"
          ? "Send to the station security desk for immediate human review."
          : `Route to ${department} and acknowledge receipt.`,
  }
}

export function detectLanguage(text: string) {
  const gujarati = /[\u0A80-\u0AFF]/.test(text)
  const hindi = /[\u0900-\u097F]/.test(text)
  const latin = /[a-z]/i.test(text)
  if (gujarati && latin) return "ગુજરાતી / Gujlish"
  if (hindi && latin) return "हिन्दी / English"
  if (gujarati) return "ગુજરાતી"
  if (hindi) return "हिन्दी"
  const gujlish = /\b(nathi|chhe|bahu|kachro|paisa|thai|modi|bhid)\b/i.test(
    text,
  )
  return gujlish ? "Gujlish" : "English"
}
