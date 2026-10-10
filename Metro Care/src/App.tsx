import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  AlertTriangle,
  Activity,
  ArrowDownUp,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clipboard,
  Clock3,
  Cloud,
  CloudOff,
  FileText,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  Wifi,
  X,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge, Button, Card, Field, Modal, inputClass } from "./components/ui"
import { useComplaints } from "./hooks/useComplaints"
import {
  addComplaint,
  getSyncMetadata,
  linkComplaintsToIncident,
  removeComplaint,
  updateComplaint,
} from "./lib/database"
import {
  classifyComplaint,
  departmentFor,
  detectLanguage,
} from "./lib/classifier"
import { findPossibleDuplicates } from "./lib/duplicates"
import { createDraftReply } from "./lib/replyTemplates"
import { runDemoSync } from "./lib/sync"
import {
  CATEGORIES,
  STATIONS,
  type Category,
  type Complaint,
  type Priority,
  type ReplyLanguage,
  type Status,
} from "./types"

type Page = "Dashboard" | "All Complaints" | "New Complaint" | "Priority Queue" | "Analytics" | "Sync Centre" | "Settings"
interface NavItem {
  label: Page
  icon: typeof LayoutDashboard
}
interface ChartDatum {
  name: string
  value: number
}
interface DailyDatum {
  name: string
  received: number
  resolved: number
}
const nav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "All Complaints", icon: Inbox },
  { label: "New Complaint", icon: Plus },
  { label: "Priority Queue", icon: ShieldAlert },
  { label: "Analytics", icon: BarChart3 },
  { label: "Sync Centre", icon: RefreshCw },
  { label: "Settings", icon: Settings },
]
const priorities: Priority[] = ["Critical", "High", "Medium", "Low"]
const statuses: Status[] = ["Open", "In Progress", "Resolved"]
const languages: ReplyLanguage[] = ["English", "ગુજરાતી", "हिन्दी"]
const staff = ["Unassigned", "Kavita P.", "Rohan S.", "Mehul D.", "Nisha T."]
const pieColors = [
  "#f97316",
  "#334155",
  "#ef4444",
  "#10b981",
  "#8b5cf6",
  "#0ea5e9",
  "#eab308",
  "#64748b",
]

function priorityTone(priority: Priority) {
  return priority === "Critical"
    ? "red"
    : priority === "High"
      ? "orange"
      : priority === "Medium"
        ? "blue"
        : "neutral"
}

function statusTone(status: Status) {
  return status === "Resolved"
    ? "green"
    : status === "In Progress"
      ? "purple"
      : "blue"
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "slate",
  onClick,
  active = false,
}: {
  label: string
  value: string | number
  note: string
  icon: typeof Inbox
  tone?: "slate" | "red" | "orange" | "green"
  onClick?: () => void
  active?: boolean
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600",
    green: "bg-emerald-50 text-emerald-600",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={`w-full rounded-2xl border bg-white p-5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition ${
        onClick ? "hover:-translate-y-0.5 hover:shadow-md" : "cursor-default"
      } ${
        active
          ? "border-orange-400 ring-4 ring-orange-100"
          : "border-slate-200/80"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <div className={`rounded-xl p-2.5 ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{note}</p>
    </button>
  )
}

function ComplaintTable({
  items,
  onOpen,
  compact = false,
}: {
  items: Complaint[]
  onOpen: (item: Complaint) => void
  compact?: boolean
}) {
  if (!items.length) {
    return (
      <div className="grid place-items-center px-5 py-14 text-center">
        <Inbox className="mb-3 text-slate-300" size={32} />
        <p className="font-semibold text-slate-700">No complaints found</p>
        <p className="mt-1 text-sm text-slate-500">
          Try changing the filters or add a new report.
        </p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left">
        <thead className="border-y border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3 font-semibold">Complaint</th>
            <th className="px-4 py-3 font-semibold">Station</th>
            {!compact && (
              <th className="px-4 py-3 font-semibold">Department</th>
            )}
            <th className="px-4 py-3 font-semibold">Priority</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            {!compact && <th className="px-4 py-3 font-semibold">Assigned</th>}
            <th className="px-4 py-3 font-semibold">Received</th>
            <th className="px-4 py-3">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr
              key={item.id}
              className="cursor-pointer transition hover:bg-orange-50/40 focus-within:bg-orange-50/40 focus:bg-orange-50/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-400"
              onClick={() => onOpen(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onOpen(item)
                }
              }}
              tabIndex={0}
              aria-label={`Open complaint ${item.id}`}
            >
              <td className="max-w-72 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {item.id}
                  </span>
                  {item.isDemo && <Badge>Demo</Badge>}
                </div>
                <p className="mt-1 truncate text-sm font-medium text-slate-800">
                  {item.description}
                </p>
              </td>
              <td className="px-4 py-4 text-sm text-slate-600">
                {item.station}
              </td>
              {!compact && (
                <td className="px-4 py-4 text-sm text-slate-600">
                  {item.department}
                </td>
              )}
              <td className="px-4 py-4">
                <Badge tone={priorityTone(item.priority)}>
                  {item.priority}
                </Badge>
              </td>
              <td className="px-4 py-4">
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </td>
              {!compact && (
                <td className="px-4 py-4 text-sm text-slate-600">
                  {item.assignedTo}
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">
                {formatDate(item.createdAt)}
              </td>
              <td className="px-4 py-4 text-slate-400">
                <ChevronRight size={18} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function rankPriority(item: Complaint) {
  const ageHours = Math.max(
    0,
    (Date.now() - new Date(item.createdAt).getTime()) / 3600000,
  )
  return (
    (item.priority === "Critical"
      ? 100
      : item.priority === "High"
        ? 70
        : item.priority === "Medium"
          ? 40
          : 20) +
    (item.classification.needsReview ? 20 : 0) +
    (item.category === "Safety" ? 15 : 0) +
    (item.assignedTo === "Unassigned" ? 10 : 0) +
    Math.min(20, Math.floor(ageHours / 2))
  )
}

function SmartPriorityQueue({
  complaints,
  openItem,
  limit,
}: {
  complaints: Complaint[]
  openItem: (item: Complaint) => void
  limit?: number
}) {
  const ranked = complaints
    .filter((item) => !item.archived && item.status !== "Resolved")
    .sort((a, b) => rankPriority(b) - rankPriority(a))
    .slice(0, limit)
  if (!ranked.length)
    return (
      <div className="grid place-items-center px-5 py-14 text-center">
        <CheckCircle2 className="mb-3 text-emerald-400" size={34} />
        <p className="font-semibold text-slate-700">
          No urgent complaints waiting
        </p>
        <p className="mt-1 text-sm text-slate-500">
          New unresolved reports will be ranked here.
        </p>
      </div>
    )
  return (
    <div className="divide-y divide-slate-100">
      {ranked.map((item, index) => {
        const immediate =
          item.priority === "Critical" ||
          item.category === "Safety" ||
          item.classification.needsReview
        return (
          <button
            key={item.id}
            className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-orange-50/40 md:grid-cols-[auto_1fr_auto] md:items-center"
            onClick={() => openItem(item)}
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-black ${
                item.priority === "Critical"
                  ? "bg-red-600 text-white"
                  : item.priority === "High"
                    ? "bg-orange-100 text-orange-700"
                    : item.priority === "Medium"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
              }`}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500">
                  {item.id}
                </span>
                <Badge tone={priorityTone(item.priority)}>
                  {item.priority}
                </Badge>
                {immediate && <Badge tone="red">Immediate human review</Badge>}
              </span>
              <span className="mt-2 block truncate text-sm font-semibold text-slate-900">
                {item.description}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {item.station} · {item.classification.explanation}
              </span>
              <span className="mt-1 block text-xs font-semibold text-slate-700">
                Next: {item.classification.action}
              </span>
            </span>
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              Score {rankPriority(item)}
              <ChevronRight size={17} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Dashboard({
  complaints,
  openItem,
  navigate,
}: {
  complaints: Complaint[]
  openItem: (item: Complaint) => void
  navigate: (page: Page) => void
}) {
  const [dateRange, setDateRange] = useState<"7" | "30" | "all">("30")
  const [metric, setMetric] =
    useState<"all" | "open" | "critical" | "resolved" | "pending">("all")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [station, setStation] = useState("All")
  const [priority, setPriority] = useState("All")
  const [newest, setNewest] = useState(true)
  const active = complaints
    .filter((item) => !item.archived)
    .filter((item) => {
      if (dateRange === "all") return true
      const cutoff = Date.now() - Number(dateRange) * 86400000
      return new Date(item.createdAt).getTime() >= cutoff
    })
  const count = (status: Status) =>
    active.filter((item) => item.status === status).length
  const critical = active.filter((item) => item.priority === "Critical").length
  const pending = active.filter((item) => item.syncStatus !== "synced").length
  const resolvedWithTime = active.filter((item) => item.resolvedAt)
  const avgHours = resolvedWithTime.length
    ? resolvedWithTime.reduce(
        (sum, item) =>
          sum +
          (new Date(item.resolvedAt!).getTime() -
            new Date(item.createdAt).getTime()) /
            3600000,
        0,
      ) / resolvedWithTime.length
    : 0
  const categoryData = CATEGORIES.map((name) => ({
    name,
    value: active.filter((item) => item.category === name).length,
  })).filter((item) => item.value)
  const stationData = STATIONS.map((name) => ({
    name,
    value: active.filter((item) => item.station === name).length,
  }))
    .filter((item) => item.value)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
  const urgencyData = priorities.map((name) => ({
    name,
    value: active.filter((item) => item.priority === name).length,
  }))
  const dailyData = [...active]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .reduce<Record<string, DailyDatum>>((days, item) => {
      const key = new Date(item.createdAt).toISOString().slice(0, 10)
      const name = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
      }).format(new Date(item.createdAt))
      days[key] ??= { name, received: 0, resolved: 0 }
      days[key].received += 1
      if (item.status === "Resolved") days[key].resolved += 1
      return days
    }, {})
  const trends = Object.values(dailyData).slice(-10)
  const filtered = active
    .filter((item) => {
      if (metric === "open") return item.status === "Open"
      if (metric === "critical") return item.priority === "Critical"
      if (metric === "resolved") return item.status === "Resolved"
      if (metric === "pending") return item.syncStatus !== "synced"
      return true
    })
    .filter((item) =>
      `${item.id} ${item.description} ${item.station}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter((item) => category === "All" || item.category === category)
    .filter((item) => station === "All" || item.station === station)
    .filter((item) => priority === "All" || item.priority === priority)
    .sort((a, b) =>
      newest
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    )
  const clearFilters = () => {
    setMetric("all")
    setSearch("")
    setCategory("All")
    setStation("All")
    setPriority("All")
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Operations overview
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Live from this device · sample records are labelled as demo data
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            Date range
            <select
              className={`${inputClass} !min-h-10`}
              value={dateRange}
              onChange={(event) =>
                setDateRange(event.target.value as "7" | "30" | "all")
              }
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <Button
            className="self-end"
            onClick={() => navigate("New Complaint")}
          >
            <Plus size={17} />
            Log complaint
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total complaints"
          value={active.length}
          note="All locally stored reports"
          icon={Inbox}
          active={metric === "all"}
          onClick={() => setMetric("all")}
        />
        <StatCard
          label="Open"
          value={count("Open")}
          note={`${count("In Progress")} currently in progress`}
          icon={Clock3}
          tone="orange"
          active={metric === "open"}
          onClick={() => setMetric("open")}
        />
        <StatCard
          label="Critical"
          value={critical}
          note="Immediate human review"
          icon={ShieldAlert}
          tone="red"
          active={metric === "critical"}
          onClick={() => setMetric("critical")}
        />
        <StatCard
          label="Resolved"
          value={count("Resolved")}
          note={
            avgHours
              ? `${avgHours.toFixed(1)}h average resolution`
              : "No timing data yet"
          }
          icon={CheckCircle2}
          tone="green"
          active={metric === "resolved"}
          onClick={() => setMetric("resolved")}
        />
        <StatCard
          label="Pending sync"
          value={pending}
          note="Safely stored on this device"
          icon={RefreshCw}
          tone="orange"
          active={metric === "pending"}
          onClick={() => setMetric("pending")}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold text-slate-900">Complaint categories</h2>
          <p className="text-sm text-slate-500">
            Select a segment to filter recent complaints
          </p>
          <div className="mt-4 h-64">
            {categoryData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={84}
                    paddingAngle={3}
                    onClick={(_, index) =>
                      setCategory(categoryData[index]?.name ?? "All")
                    }
                    className="cursor-pointer"
                  >
                    {categoryData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-500">
                No complaints in this date range.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryData.map((item) => (
              <button
                key={item.name}
                aria-pressed={category === item.name}
                onClick={() => setCategory(item.name)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  category === item.name
                    ? "bg-orange-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.name} {item.value}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-slate-900">Station hotspots</h2>
          <p className="text-sm text-slate-500">
            Select a bar to focus the work queue
          </p>
          <div className="mt-4 h-64">
            {stationData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stationData} margin={{ left: -20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "#fff7ed" }} />
                  <Bar
                    dataKey="value"
                    fill="#f97316"
                    radius={[6, 6, 0, 0]}
                    className="cursor-pointer"
                    onClick={(data) => setStation(String(data.name))}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-500">
                No station activity to display.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {stationData.map((item) => (
              <button
                key={item.name}
                aria-pressed={station === item.name}
                onClick={() => setStation(item.name)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  station === item.name
                    ? "bg-orange-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-slate-900">Urgency distribution</h2>
          <p className="text-sm text-slate-500">
            Select a bar to filter by priority
          </p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={urgencyData} margin={{ left: -20 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: "#f8fafc" }} />
                <Bar
                  dataKey="value"
                  fill="#334155"
                  radius={[6, 6, 0, 0]}
                  className="cursor-pointer"
                  onClick={(data) => setPriority(String(data.name))}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2">
            {urgencyData.map((item) => (
              <button
                key={item.name}
                aria-pressed={priority === item.name}
                onClick={() => setPriority(item.name)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  priority === item.name
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.name} {item.value}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-slate-900">Resolution trends</h2>
          <p className="text-sm text-slate-500">
            Received versus resolved by report date
          </p>
          <div className="mt-4 h-64">
            {trends.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ left: -20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "#f8fafc" }} />
                  <Bar
                    dataKey="received"
                    fill="#334155"
                    radius={[4, 4, 0, 0]}
                    className="cursor-pointer"
                    onClick={() => setMetric("all")}
                  />
                  <Bar
                    dataKey="resolved"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    className="cursor-pointer"
                    onClick={() => setMetric("resolved")}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-500">
                Resolution trends will appear as complaints are processed.
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              aria-pressed={metric === "all"}
              onClick={() => setMetric("all")}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Received
            </button>
            <button
              aria-pressed={metric === "resolved"}
              onClick={() => setMetric("resolved")}
              className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Resolved
            </button>
          </div>
        </Card>
      </div>
      <div className="grid gap-6">
        <Card>
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="font-bold text-slate-900">Recent complaints</h2>
              <p className="text-sm text-slate-500">
                Search and filter the live local work queue
              </p>
            </div>
            <Button variant="ghost" onClick={() => navigate("All Complaints")}>
              View all <ChevronRight size={16} />
            </Button>
          </div>
          <div className="grid gap-3 border-t border-slate-100 p-4 md:grid-cols-[1fr_repeat(3,minmax(140px,0.35fr))_auto]">
            <label className="relative">
              <span className="sr-only">Search recent complaints</span>
              <Search
                className="absolute left-3 top-3 text-slate-400"
                size={18}
              />
              <input
                className={`${inputClass} pl-10`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ID, description or station…"
              />
            </label>
            <select
              aria-label="Dashboard category filter"
              className={inputClass}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>All</option>
              {CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              aria-label="Dashboard station filter"
              className={inputClass}
              value={station}
              onChange={(event) => setStation(event.target.value)}
            >
              <option>All</option>
              {STATIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              aria-label="Dashboard priority filter"
              className={inputClass}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option>All</option>
              {priorities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => setNewest(!newest)}>
              <ArrowDownUp size={16} />
              {newest ? "Newest" : "Oldest"}
            </Button>
          </div>
          {(metric !== "all" ||
            search ||
            category !== "All" ||
            station !== "All" ||
            priority !== "All") && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Showing {filtered.length} matching complaints
              <Button
                variant="ghost"
                className="ml-auto !min-h-8 !px-2 !py-1"
                onClick={clearFilters}
              >
                Clear dashboard filters
              </Button>
            </div>
          )}
          <ComplaintTable
            items={filtered.slice(0, 8)}
            onOpen={openItem}
            compact
          />
        </Card>
      </div>
      <Card>
        <div className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-bold text-slate-900">Priority queue</h2>
            <p className="text-sm text-slate-500">
              All unresolved reports ranked by operational urgency
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate("Priority Queue")}>
            Open queue <ChevronRight size={16} />
          </Button>
        </div>
        <SmartPriorityQueue complaints={active} openItem={openItem} limit={5} />
      </Card>
    </div>
  )
}

function NewComplaint({
  onSaved,
  onCancel,
}: {
  onSaved: (item: Complaint) => void
  onCancel: () => void
}) {
  const [description, setDescription] = useState("")
  const [station, setStation] = useState("")
  const [category, setCategory] = useState<Category>("Other")
  const [language, setLanguage] = useState("Auto-detect")
  const [photo, setPhoto] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const prediction =
    description.trim().length > 4
      ? classifyComplaint(description, category)
      : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (description.trim().length < 8 || !station) {
      setError("Choose a station and enter at least 8 characters.")
      return
    }
    setSaving(true)
    try {
      const classification = classifyComplaint(description, category)
      const item = await addComplaint(
        {
          description: description.trim(),
          station,
          category,
          language:
            language === "Auto-detect" ? detectLanguage(description) : language,
          photo,
        },
        classification,
      )
      onSaved(item)
    } catch {
      setError(
        "The complaint could not be saved to this device. Please check storage permissions.",
      )
    } finally {
      setSaving(false)
    }
  }

  function readPhoto(file?: File) {
    if (!file) return
    if (file.size > 1_500_000) {
      setError("Please choose an image smaller than 1.5 MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Log a new complaint
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Works fully offline. No personal passenger details are required.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
      >
        <Card className="space-y-5 p-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Complaint details</h2>
              <p className="text-sm text-slate-500">
                A unique ID and timestamp will be generated
              </p>
            </div>
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}
          <Field label="Station">
            <select
              className={inputClass}
              value={station}
              onChange={(event) => setStation(event.target.value)}
              required
            >
              <option value="">Select a metro station</option>
              {STATIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Complaint description"
            hint="English, ગુજરાતી, हिन्दी and Gujlish are supported"
          >
            <textarea
              className={`${inputClass} min-h-36 resize-y`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what happened, where, and whether anyone is in immediate danger…"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Original language">
              <select
                className={inputClass}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option>Auto-detect</option>
                <option>English</option>
                <option>ગુજરાતી</option>
                <option>हिन्दी</option>
                <option>Gujlish</option>
              </select>
            </Field>
            <Field label="Staff-selected category">
              <select
                className={inputClass}
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as Category)
                }
              >
                {CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Photo (optional)"
            hint="Stored only on this device · maximum 1.5 MB"
          >
            <input
              className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold`}
              type="file"
              accept="image/*"
              onChange={(event) => readPhoto(event.target.files?.[0])}
            />
          </Field>
          {photo && (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              <img
                src={photo}
                className="h-14 w-14 rounded-lg object-cover"
                alt="Attachment preview"
              />
              <span className="text-sm font-medium text-slate-600">
                Photo ready for offline storage
              </span>
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <RefreshCw className="animate-spin" size={17} />
              ) : (
                <Plus size={17} />
              )}
              {saving ? "Saving locally…" : "Save complaint"}
            </Button>
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <CircleGauge size={19} className="text-orange-500" />
                On-device analysis
              </div>
              <Badge tone="green">Offline ready</Badge>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              On-device rule-based classification — not a machine-learning model
            </p>
            {prediction ? (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Predicted category</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {prediction.category}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Rule confidence</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {prediction.confidence}%
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Department
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {prediction.department}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Urgency
                  </p>
                  <div className="mt-1">
                    <Badge tone={priorityTone(prediction.priority)}>
                      {prediction.priority}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Why</p>
                  <p className="mt-1">{prediction.explanation}</p>
                  <p className="mt-3 font-semibold text-slate-800">
                    Recommended action
                  </p>
                  <p className="mt-1">{prediction.action}</p>
                </div>
                {prediction.needsReview && (
                  <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                    <AlertTriangle className="shrink-0" size={18} />
                    <span>
                      Manual review required. Staff can override all predictions
                      after saving.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Start typing to preview local classification.
              </div>
            )}
          </Card>
          <div className="flex gap-3 rounded-xl bg-slate-900 p-4 text-sm text-slate-300">
            <ShieldAlert className="shrink-0 text-orange-400" size={20} />
            <p>
              Immediate danger, fire, smoke, violence, or medical emergencies
              are escalated to Critical for human review.
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}

function AllComplaints({
  complaints,
  openItem,
}: {
  complaints: Complaint[]
  openItem: (item: Complaint) => void
}) {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [station, setStation] = useState("All")
  const [priority, setPriority] = useState("All")
  const [status, setStatus] = useState("All")
  const [newest, setNewest] = useState(true)
  const [quickFilter, setQuickFilter] =
    useState<"All" | "Needs review" | "Unassigned" | "Pending sync">("All")
  const filtered = useMemo(
    () =>
      complaints
        .filter((item) => !item.archived)
        .filter((item) =>
          `${item.id} ${item.description} ${item.assignedTo}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .filter((item) => category === "All" || item.category === category)
        .filter((item) => station === "All" || item.station === station)
        .filter((item) => priority === "All" || item.priority === priority)
        .filter((item) => status === "All" || item.status === status)
        .filter(
          (item) =>
            quickFilter === "All" ||
            (quickFilter === "Needs review" &&
              item.classification.needsReview) ||
            (quickFilter === "Unassigned" &&
              item.assignedTo === "Unassigned") ||
            (quickFilter === "Pending sync" && item.syncStatus !== "synced"),
        )
        .sort((a, b) =>
          newest
            ? b.createdAt.localeCompare(a.createdAt)
            : a.createdAt.localeCompare(b.createdAt),
        ),
    [
      complaints,
      search,
      category,
      station,
      priority,
      status,
      newest,
      quickFilter,
    ],
  )
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          All complaints
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Search, filter and manage every report stored on this device
        </p>
      </div>
      <Card>
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(130px,0.45fr))_auto]">
          <label className="relative">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={18}
            />
            <input
              className={`${inputClass} pl-10`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID, complaint, staff…"
            />
          </label>
          <select
            aria-label="Category filter"
            className={inputClass}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option>All</option>
            {CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Station filter"
            className={inputClass}
            value={station}
            onChange={(event) => setStation(event.target.value)}
          >
            <option>All</option>
            {STATIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Priority filter"
            className={inputClass}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option>All</option>
            {priorities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Status filter"
            className={inputClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option>All</option>
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={() => setNewest(!newest)}
            title="Change sort order"
          >
            <ArrowDownUp size={16} />
            {newest ? "Newest" : "Oldest"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-400">
            Quick filters
          </span>
          {(["All", "Needs review", "Unassigned", "Pending sync"] as const).map(
            (filter) => (
              <button
                key={filter}
                aria-pressed={quickFilter === filter}
                onClick={() => setQuickFilter(filter)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  quickFilter === filter
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filter}
              </button>
            ),
          )}
          {(search ||
            category !== "All" ||
            station !== "All" ||
            priority !== "All" ||
            status !== "All" ||
            quickFilter !== "All") && (
            <button
              className="ml-auto text-xs font-semibold text-orange-600 hover:text-orange-700"
              onClick={() => {
                setSearch("")
                setCategory("All")
                setStation("All")
                setPriority("All")
                setStatus("All")
                setQuickFilter("All")
              }}
            >
              Clear all filters
            </button>
          )}
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-xs font-medium text-slate-500">
          {filtered.length} of{" "}
          {complaints.filter((item) => !item.archived).length} complaints
        </div>
        <ComplaintTable items={filtered} onOpen={openItem} />
      </Card>
    </div>
  )
}

function Analytics({ complaints }: { complaints: Complaint[] }) {
  const active = complaints.filter((item) => !item.archived)
  const by = (key: "department" | "station") =>
    Object.entries(
      active.reduce<Record<string, number>>(
        (acc, item) => ({ ...acc, [item[key]]: (acc[item[key]] ?? 0) + 1 }),
        {},
      ),
    )
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  const priority = priorities.map((name) => ({
    name,
    value: active.filter((item) => item.priority === name).length,
  }))
  const trends = Object.entries(
    active.reduce<Record<string, number>>((acc, item) => {
      const day = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
      }).format(new Date(item.createdAt))
      acc[day] = (acc[day] ?? 0) + 1
      return acc
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .reverse()
  const recurring = CATEGORIES.map((name) => ({
    name,
    value: active.filter((item) => item.category === name).length,
  }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
  const ChartCard = ({
    title,
    subtitle,
    data,
    color = "#f97316",
  }: {
    title: string
    subtitle: string
    data: ChartDatum[]
    color?: string
  }) => (
    <Card className="p-5">
      <h2 className="font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
      <div className="mt-5 h-64">
        {data.some((item) => item.value) ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-500">
            Not enough local data yet.
          </div>
        )}
      </div>
    </Card>
  )
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Local analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Insights calculated entirely on this device
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="By department"
          subtitle="Workload distribution"
          data={by("department")}
        />
        <ChartCard
          title="By station"
          subtitle="Reports across stations"
          data={by("station")}
          color="#334155"
        />
        <ChartCard
          title="Priority distribution"
          subtitle="Urgency profile"
          data={priority}
          color="#ef4444"
        />
        <ChartCard
          title="Daily complaint trend"
          subtitle="Complaint volume by received date"
          data={trends}
          color="#10b981"
        />
      </div>
      <Card className="p-5">
        <h2 className="font-bold text-slate-900">
          Frequently recurring issues
        </h2>
        <p className="text-sm text-slate-500">
          Most common categories in local records
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recurring.map((item, index) => (
            <div key={item.name} className="rounded-xl bg-slate-50 p-4">
              <span className="text-xs font-bold text-slate-400">
                0{index + 1}
              </span>
              <p className="mt-3 font-semibold text-slate-800">{item.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {item.value} reports
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SyncCentre({
  complaints,
  syncing,
  onSync,
}: {
  complaints: Complaint[]
  syncing: boolean
  onSync: (ids?: string[]) => Promise<void>
}) {
  const pending = complaints.filter((item) => item.syncStatus === "pending")
  const synced = complaints.filter((item) => item.syncStatus === "synced")
  const failed = complaints.filter((item) => item.syncStatus === "failed")
  const [metadata, setMetadata] =
    useState<Awaited<ReturnType<typeof getSyncMetadata>>>([])
  useEffect(() => {
    getSyncMetadata().then(setMetadata)
  }, [complaints, syncing])
  const lastSync = metadata
    .map((item) => item.lastAttempt)
    .sort()
    .at(-1)
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Sync Centre
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review persistent local records, retries and delivery state
          </p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            Last simulated sync:{" "}
            {lastSync ? formatDate(lastSync) : "No sync attempted yet"}
          </p>
        </div>
        <Button
          onClick={() => onSync()}
          disabled={syncing || (!pending.length && !failed.length)}
        >
          <RefreshCw className={syncing ? "animate-spin" : ""} size={17} />
          {syncing ? "Simulating…" : "Retry sync"}
        </Button>
      </div>
      <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
        <Cloud size={22} className="shrink-0" />
        <div>
          <p className="font-bold">Local demo sync mode</p>
          <p className="mt-1 text-blue-800">
            No backend is configured. Sync marks records as simulated locally
            synced; it does not send data to Ahmedabad Metro or any server.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pending"
          value={pending.length}
          note="Safely retained on this device"
          icon={Clock3}
          tone="orange"
        />
        <StatCard
          label="Simulated synced"
          value={synced.length}
          note="No actual server delivery"
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          label="Failed"
          value={failed.length}
          note="Available for safe retry"
          icon={AlertTriangle}
          tone="red"
        />
      </div>
      <Card>
        <div className="p-5">
          <h2 className="font-bold text-slate-900">Sync records</h2>
          <p className="text-sm text-slate-500">
            Stable IDs prevent duplicate processing
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {!complaints.length && (
            <div className="grid place-items-center px-5 py-14 text-center">
              <Cloud className="mb-3 text-slate-300" size={34} />
              <p className="font-semibold text-slate-700">
                No local sync records
              </p>
              <p className="mt-1 text-sm text-slate-500">
                New and edited complaints will appear here.
              </p>
            </div>
          )}
          {complaints.map((item) => {
            const record = metadata.find((entry) => entry.id === item.id)
            return (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-bold text-slate-600">
                    {item.id}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {item.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {record
                      ? `Last attempt ${formatDate(record.lastAttempt)} · ${item.syncAttempts} attempt${
                          item.syncAttempts === 1 ? "" : "s"
                        }`
                      : "No sync attempt recorded"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      item.syncStatus === "synced"
                        ? "green"
                        : item.syncStatus === "failed"
                          ? "red"
                          : "orange"
                    }
                  >
                    {item.syncStatus === "synced"
                      ? "Simulated synced"
                      : item.syncStatus}
                  </Badge>
                  {item.syncStatus !== "synced" && (
                    <Button
                      variant="secondary"
                      className="!min-h-9 !px-3"
                      disabled={syncing}
                      onClick={() => onSync([item.id])}
                    >
                      <RefreshCw size={14} />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function DetailModal({
  item,
  complaints,
  onClose,
  onChanged,
}: {
  item: Complaint
  complaints: Complaint[]
  onClose: () => void
  onChanged: () => void
}) {
  const [current, setCurrent] = useState(item)
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>(
    item.reply?.language ?? "English",
  )
  const [drafts, setDrafts] =
    useState<Partial<Record<ReplyLanguage, Complaint["reply"]>>>({
      ...item.replyDrafts,
      ...(item.reply ? { [item.reply.language]: item.reply } : {}),
    })
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const activeReply = drafts[replyLanguage]
  const reply = activeReply?.body ?? createDraftReply(current, replyLanguage)
  const duplicates = findPossibleDuplicates(current, complaints)

  async function save(changes: Partial<Complaint>) {
    setBusy(true)
    try {
      const updated = await updateComplaint(current.id, changes)
      setCurrent(updated)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }
  function changeLanguage(language: ReplyLanguage) {
    setReplyLanguage(language)
  }
  async function saveReply(reviewed: boolean) {
    const saved = {
      language: replyLanguage,
      body: reply,
      reviewed,
      updatedAt: new Date().toISOString(),
    }
    const nextDrafts = { ...drafts, [replyLanguage]: saved }
    setDrafts(nextDrafts)
    await save({
      reply: saved,
      replyDrafts: nextDrafts,
    })
  }
  async function linkDuplicate(duplicateId: string) {
    const incidentId = await linkComplaintsToIncident([current.id, duplicateId])
    const updated = await updateComplaint(current.id, { incidentId })
    setCurrent(updated)
    await onChanged()
  }
  async function archive() {
    if (
      !confirm(
        "Archive this complaint? It will be hidden from active lists but retained locally.",
      )
    )
      return
    await save({ archived: true })
    onClose()
  }
  async function permanentlyDelete() {
    if (
      !confirm(
        "Permanently delete this complaint from this device? This cannot be undone.",
      )
    )
      return
    await removeComplaint(current.id)
    await onChanged()
    onClose()
  }
  return (
    <Modal title="Complaint details" onClose={onClose}>
      <div className="space-y-6 p-5 sm:p-6">
        {(current.priority === "Critical" || current.category === "Safety") && (
          <div className="flex gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <ShieldAlert className="shrink-0" size={20} />
            <div>
              <p className="font-bold">Urgent human review required</p>
              <p className="mt-1">
                Verify conditions with station staff. This report will never be
                automatically resolved.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-500">
                {current.id}
              </span>
              {current.isDemo && <Badge>Demo data</Badge>}
              <Badge
                tone={current.syncStatus === "synced" ? "green" : "orange"}
              >
                {current.syncStatus === "synced"
                  ? "Simulated synced"
                  : "Pending sync"}
              </Badge>
            </div>
            <p className="mt-3 text-lg font-semibold leading-relaxed text-slate-900">
              {current.description}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {current.station} · {formatDate(current.createdAt)} ·{" "}
              {current.language}
            </p>
          </div>
          <Badge tone={priorityTone(current.priority)}>
            {current.priority}
          </Badge>
        </div>
        {current.photo && (
          <img
            src={current.photo}
            alt="Complaint attachment"
            className="max-h-64 w-full rounded-xl object-cover"
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <select
              className={inputClass}
              value={current.status}
              disabled={busy}
              onChange={(event) =>
                save({ status: event.target.value as Status })
              }
            >
              {statuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Assigned staff member">
            <select
              className={inputClass}
              value={current.assignedTo}
              disabled={busy}
              onChange={(event) => save({ assignedTo: event.target.value })}
            >
              {staff.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Category override">
            <select
              className={inputClass}
              value={current.category}
              disabled={busy}
              onChange={(event) => {
                const category = event.target.value as Category
                save({
                  category,
                  department: departmentFor(category),
                  classification: {
                    ...current.classification,
                    category,
                    department: departmentFor(category),
                    needsReview: false,
                  },
                })
              }}
            >
              {CATEGORIES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Urgency override">
            <select
              className={inputClass}
              value={current.priority}
              disabled={busy}
              onChange={(event) =>
                save({
                  priority: event.target.value as Priority,
                  classification: {
                    ...current.classification,
                    priority: event.target.value as Priority,
                    needsReview: false,
                  },
                })
              }
            >
              {priorities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Department override">
            <input
              className={inputClass}
              value={current.department}
              disabled={busy}
              onChange={(event) =>
                setCurrent({ ...current, department: event.target.value })
              }
              onBlur={() =>
                save({
                  department: current.department,
                  classification: {
                    ...current.classification,
                    department: current.department,
                    needsReview: false,
                  },
                })
              }
            />
          </Field>
        </div>
        <Field
          label="Resolution / internal notes"
          hint="Record only confirmed actions. Changes are saved on this device."
        >
          <textarea
            className={`${inputClass} min-h-24`}
            value={current.resolutionNotes}
            onChange={(event) =>
              setCurrent({ ...current, resolutionNotes: event.target.value })
            }
            onBlur={() =>
              current.resolutionNotes !== item.resolutionNotes &&
              save({ resolutionNotes: current.resolutionNotes })
            }
            placeholder="Add handover, inspection, or confirmed resolution notes…"
          />
        </Field>
        <Card className="border-slate-200 bg-slate-50/60 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <MessageSquareText size={18} className="text-orange-500" />
                Suggested reply
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Draft requiring staff approval · generated locally
              </p>
            </div>
            <div className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200">
              {languages.map((language) => (
                <button
                  key={language}
                  onClick={() => changeLanguage(language)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    replyLanguage === language
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {language}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className={`${inputClass} mt-4 min-h-36 bg-white`}
            value={reply}
            aria-label={`${replyLanguage} reply draft`}
            onChange={(event) =>
              setDrafts({
                ...drafts,
                [replyLanguage]: {
                  language: replyLanguage,
                  body: event.target.value,
                  reviewed: false,
                  updatedAt: new Date().toISOString(),
                },
              })
            }
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(reply)
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }}
            >
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? "Copied" : "Copy draft"}
            </Button>
            <Button variant="secondary" onClick={() => saveReply(false)}>
              Save draft
            </Button>
            <Button onClick={() => saveReply(true)}>
              <CheckCircle2 size={16} />
              Mark reviewed
            </Button>
          </div>
          {activeReply && (
            <p className="mt-3 text-right text-xs font-medium text-slate-500">
              {activeReply.reviewed
                ? `${replyLanguage} version approved by staff`
                : `${replyLanguage} version saved as an unreviewed draft`}
            </p>
          )}
        </Card>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            On-device rule-based classification
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Department</p>
              <p className="text-sm font-semibold text-slate-800">
                {current.department}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Rule match</p>
              <p className="text-sm font-semibold text-slate-800">
                {current.classification.confidence}% confidence
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {current.classification.explanation}
          </p>
          {!!current.classification.matchedRules?.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {current.classification.matchedRules.map((rule) => (
                <Badge key={rule} tone="blue">
                  Matched: {rule}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {current.classification.action}
          </p>
        </div>
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <Link2 size={18} className="text-orange-500" />
                Possible duplicate reports
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Same station and category with similar description terms
              </p>
            </div>
            {current.incidentId && (
              <Badge tone="purple">{current.incidentId}</Badge>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {!duplicates.length && (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">
                No likely duplicates found. Individual reports remain
                independent.
              </div>
            )}
            {duplicates.slice(0, 3).map(({ complaint, similarity }) => (
              <div
                key={complaint.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-slate-500">
                    {complaint.id} · {Math.round(similarity * 100)}% text match
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-slate-800">
                    {complaint.description}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="shrink-0"
                  disabled={
                    busy ||
                    (!!current.incidentId &&
                      current.incidentId === complaint.incidentId)
                  }
                  onClick={() => linkDuplicate(complaint.id)}
                >
                  <Link2 size={15} />
                  {current.incidentId === complaint.incidentId
                    ? "Linked"
                    : "Link as incident"}
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Linking groups related reports without merging or deleting either
            complaint.
          </p>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <Activity size={18} className="text-orange-500" />
            Complaint activity
          </h3>
          <div className="mt-5 space-y-0">
            {(current.activity?.length
              ? [...current.activity].reverse()
              : [
                  {
                    id: `legacy-${current.id}`,
                    type: "submitted" as const,
                    message: "Complaint submitted and stored locally.",
                    at: current.createdAt,
                    actor: "MetroCare",
                  },
                ]
            ).map((event, index, events) => (
              <div key={event.id} className="grid grid-cols-[24px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-500 ring-4 ring-orange-50" />
                  {index < events.length - 1 && (
                    <span className="min-h-12 w-px flex-1 bg-slate-200" />
                  )}
                </div>
                <div className="pb-5">
                  <p className="text-sm font-semibold text-slate-800">
                    {event.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {event.actor} · {formatDate(event.at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5">
          <Button variant="danger" onClick={permanentlyDelete}>
            <Trash2 size={16} />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={archive}>
              Archive
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Offline and privacy configuration
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Local-first privacy</h2>
              <p className="text-sm text-slate-500">Enabled by design</p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <p>
              Complaint data, photos, replies and sync metadata remain in this
              browser's IndexedDB.
            </p>
            <p>
              No analytics, external AI, cloud database or authentication
              service is used.
            </p>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600">
              <Cloud size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Sync configuration</h2>
              <p className="text-sm text-slate-500">Local demo mode</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            No backend endpoint is configured. Records marked “simulated synced”
            have not left this device.
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-bold text-slate-900">About MetroCare</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            MetroCare — Every Complaint Heard is an offline-first prototype for
            PS-07 at Metro Hacks by DevFest Gandhinagar. It helps Ahmedabad
            Metro staff triage multilingual passenger reports while keeping
            humans in control of safety decisions.
          </p>
        </Card>
      </div>
    </div>
  )
}

export default function App() {
  const { complaints, loading, error, refresh, lastSavedAt } = useComplaints()
  const [page, setPage] = useState<Page>("Dashboard")
  const [selected, setSelected] = useState<Complaint | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [sidebar, setSidebar] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState("")
  const pending = complaints.filter(
    (item) => item.syncStatus === "pending",
  ).length

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    addEventListener("online", update)
    addEventListener("offline", update)
    return () => {
      removeEventListener("online", update)
      removeEventListener("offline", update)
    }
  }, [])

  function navigate(next: Page) {
    setPage(next)
    setSidebar(false)
  }
  function notify(message: string) {
    setToast(message)
    setTimeout(() => setToast(""), 2800)
  }
  async function sync(ids?: string[]) {
    setSyncing(true)
    try {
      const count = await runDemoSync(ids)
      await refresh()
      notify(
        count
          ? `${count} record${
              count === 1 ? "" : "s"
            } marked as simulated synced.`
          : "Everything is already up to date.",
      )
    } catch {
      notify("Local sync state could not be updated. Your records remain safe.")
    } finally {
      setSyncing(false)
    }
  }
  const title = page === "Dashboard" ? "Good morning, Operations Team" : page
  const visibleComplaints = complaints.filter((item) => !item.archived)
  let content
  if (loading)
    content = (
      <div className="grid min-h-[50vh] place-items-center">
        <RefreshCw className="animate-spin text-orange-500" />
      </div>
    )
  else if (page === "Dashboard")
    content = (
      <Dashboard
        complaints={complaints}
        openItem={setSelected}
        navigate={navigate}
      />
    )
  else if (page === "New Complaint")
    content = (
      <NewComplaint
        onCancel={() => navigate("Dashboard")}
        onSaved={async (item) => {
          await refresh()
          notify(`${item.id} saved locally and added to pending sync.`)
          setSelected(item)
          navigate("All Complaints")
        }}
      />
    )
  else if (page === "All Complaints")
    content = <AllComplaints complaints={complaints} openItem={setSelected} />
  else if (page === "Priority Queue")
    content = (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Priority queue
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Critical, high, medium and low reports ranked for human review
          </p>
        </div>
        <Card>
          <div className="border-b border-slate-100 px-5 py-4 text-xs text-slate-500">
            Ranked by urgency, safety review, assignment state and waiting time.
            Scores are transparent operational rules, not AI.
          </div>
          <SmartPriorityQueue
            complaints={visibleComplaints}
            openItem={setSelected}
          />
        </Card>
      </div>
    )
  else if (page === "Analytics") content = <Analytics complaints={complaints} />
  else if (page === "Sync Centre")
    content = (
      <SyncCentre complaints={complaints} syncing={syncing} onSync={sync} />
    )
  else content = <SettingsPage />

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 size={17} className="text-emerald-400" />
          {toast}
        </div>
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-[#101c2f] text-white shadow-xl transition-transform lg:translate-x-0 ${
          sidebar ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 font-black">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MetroCare</p>
              <p className="text-xs text-slate-400">Every Complaint Heard</p>
            </div>
          </div>
          <button
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden"
            onClick={() => setSidebar(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => navigate(label)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                page === label
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-950/20"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon size={19} />
              {label}
              {label === "Sync Centre" && pending > 0 && (
                <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-xs">
                  {pending}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span
                className={`h-2 w-2 rounded-full ${
                  online ? "bg-emerald-400" : "bg-orange-400"
                }`}
              />
              {online ? "Device online" : "Offline Mode"}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {online
                ? `${pending} local change${
                    pending === 1 ? "" : "s"
                  } pending demo sync`
                : "All changes saved on this device"}
            </p>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setSidebar(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setSidebar(true)}
            >
              <Menu size={21} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 sm:text-base">
                {title}
              </p>
              <p className="hidden text-xs text-slate-500 sm:block">
                Ahmedabad Metro ·{" "}
                {lastSavedAt
                  ? `Saved locally ${formatDate(lastSavedAt)}`
                  : "Local operations workspace"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className={`hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold sm:flex ${
                online
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-orange-50 text-orange-700"
              }`}
            >
              {online ? <Wifi size={15} /> : <CloudOff size={15} />}
              {online ? "Online" : "Offline Mode"}
            </div>
            {pending > 0 && (
              <button
                onClick={() => navigate("Sync Centre")}
                className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
              >
                <RefreshCw size={14} />
                {pending}
                <span className="hidden sm:inline">pending</span>
              </button>
            )}
            <button
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Open priority alerts"
              onClick={() => navigate("Priority Queue")}
            >
              <Bell size={20} />
              {complaints.some(
                (item) =>
                  item.priority === "Critical" && item.status !== "Resolved",
              ) && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
              OT
            </div>
          </div>
        </header>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-orange-500 px-4 py-2 text-center text-xs font-semibold text-white">
            <CloudOff size={14} />
            Offline Mode — All changes saved on this device
          </div>
        )}
        {error && (
          <div className="m-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
        <main className="p-4 sm:p-6 lg:p-8">{content}</main>
      </div>
      {selected && (
        <DetailModal
          item={complaints.find((item) => item.id === selected.id) ?? selected}
          complaints={complaints}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
    </div>
  )
}
