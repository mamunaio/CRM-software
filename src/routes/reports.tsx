import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatUSD } from "@/lib/format";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, TrendingUp, FileText, AlertTriangle, FileEdit, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/reports")({
  component: () => <RequireAuth><ReportsPage /></RequireAuth>,
  head: () => ({ meta: [{ title: "Reports — Pinnacle CRM" }] }),
});

type Range = "week" | "month" | "quarter" | "year";

const RANGE_LABELS: Record<Range, string> = {
  week: "This Week",
  month: "This Month",
  quarter: "Last 3 Months",
  year: "This Year",
};

function rangeStart(range: Range): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "week") {
    const day = d.getDay();
    d.setDate(d.getDate() - day);
  } else if (range === "month") {
    d.setDate(1);
  } else if (range === "quarter") {
    d.setMonth(d.getMonth() - 2, 1);
  } else {
    d.setMonth(0, 1);
  }
  return d;
}

const LEAD_STAGES = ["new", "contacted", "qualified", "proposal_sent", "converted"] as const;
const LEAD_LABELS: Record<(typeof LEAD_STAGES)[number], string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal",
  converted: "Converted",
};

function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const uid = user!.id;
  const [range, setRange] = useState<Range>("month");
  const start = useMemo(() => rangeStart(range), [range]);

  const { data } = useQuery({
    queryKey: ["reports", uid],
    queryFn: async () => {
      const [invoices, leads, deals, tasks, goals] = await Promise.all([
        supabase.from("invoices").select("id,status,total,issue_date,client_name"),
        supabase.from("leads").select("id,status,created_at"),
        supabase.from("deals").select("id,stage,value,created_at"),
        supabase.from("tasks").select("id,status,created_at,due_date"),
        supabase.from("monthly_goals").select("month,target"),
      ]);
      return {
        invoices: invoices.data ?? [],
        leads: leads.data ?? [],
        deals: deals.data ?? [],
        tasks: tasks.data ?? [],
        goals: goals.data ?? [],
      };
    },
  });

  const invoices = (data?.invoices ?? []) as any[];
  const leads = (data?.leads ?? []) as any[];
  const deals = (data?.deals ?? []) as any[];
  const tasks = (data?.tasks ?? []) as any[];
  const goals = (data?.goals ?? []) as any[];

  // Revenue last 12 months (paid invoices)
  const revenueChart = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; revenue: number; target: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({
        key,
        label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        revenue: 0,
        target: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const inv of invoices) {
      if (inv.status !== "paid") continue;
      const d = new Date(inv.issue_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const i = idx.get(key);
      if (i !== undefined) buckets[i].revenue += Number(inv.total) || 0;
    }
    for (const g of goals) {
      const d = new Date(g.month);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const i = idx.get(key);
      if (i !== undefined) buckets[i].target = Number(g.target) || 0;
    }
    return buckets;
  }, [invoices, goals]);

  const totalEarned = revenueChart.reduce((s, b) => s + b.revenue, 0);
  const totalTarget = revenueChart.reduce((s, b) => s + b.target, 0);

  // Lead funnel (filtered by range using created_at)
  const funnelData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of LEAD_STAGES) counts[s] = 0;
    for (const l of leads) {
      if (new Date(l.created_at) < start) continue;
      if (counts[l.status] !== undefined) counts[l.status]++;
    }
    const total = LEAD_STAGES.reduce((s, k) => s + counts[k], 0) || 1;
    return LEAD_STAGES.map((s) => ({
      stage: LEAD_LABELS[s],
      count: counts[s],
      pct: Math.round((counts[s] / total) * 100),
    }));
  }, [leads, start]);
  const conversionRate = useMemo(() => {
    const totalLeads = funnelData.reduce((s, x) => s + x.count, 0);
    const converted = funnelData.find((f) => f.stage === "Converted")?.count ?? 0;
    return totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;
  }, [funnelData]);

  // Deal win/loss
  const dealsInRange = deals.filter((d) => new Date(d.created_at) >= start);
  const wonCount = dealsInRange.filter((d) => d.stage === "won").length;
  const lostCount = dealsInRange.filter((d) => d.stage === "lost").length;
  const openCount = dealsInRange.filter((d) => d.stage !== "won" && d.stage !== "lost").length;
  const pieData = [
    { name: "Won", value: wonCount, color: "var(--success)" },
    { name: "Lost", value: lostCount, color: "var(--destructive)" },
    { name: "Open", value: openCount, color: "var(--info)" },
  ];

  // Top clients by revenue (paid only)
  const topClients = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status !== "paid") continue;
      map.set(inv.client_name, (map.get(inv.client_name) ?? 0) + (Number(inv.total) || 0));
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [invoices]);

  // Invoice summary (all-time totals across statuses)
  const invSummary = useMemo(() => {
    let paid = 0, overdue = 0, draft = 0;
    for (const inv of invoices) {
      const t = Number(inv.total) || 0;
      if (inv.status === "paid") paid += t;
      else if (inv.status === "overdue") overdue += t;
      else if (inv.status === "draft") draft += t;
    }
    return { paid, overdue, draft };
  }, [invoices]);

  // Task completion this month
  const taskStats = useMemo(() => {
    const monthStart = rangeStart("month");
    const inMonth = tasks.filter((t) => new Date(t.created_at) >= monthStart);
    const done = inMonth.filter((t) => t.status === "done").length;
    const total = inMonth.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
  }, [tasks]);

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Pinnacle CRM — Analytics Report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Range: ${RANGE_LABELS[range]}    Generated: ${new Date().toLocaleString()}`, 14, 25);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 32,
      head: [["Metric", "Value"]],
      body: [
        ["Total revenue (12 months)", formatUSD(totalEarned)],
        ["Total target (12 months)", formatUSD(totalTarget)],
        ["Lead conversion rate", `${conversionRate}%`],
        ["Deals won", String(wonCount)],
        ["Deals lost", String(lostCount)],
        ["Deals open", String(openCount)],
        ["Invoices paid", formatUSD(invSummary.paid)],
        ["Invoices overdue", formatUSD(invSummary.overdue)],
        ["Invoices draft", formatUSD(invSummary.draft)],
        ["Task completion (this month)", `${taskStats.pct}% (${taskStats.done}/${taskStats.total})`],
      ],
    });

    autoTable(doc, {
      head: [["Lead Stage", "Count", "% of total"]],
      body: funnelData.map((f) => [f.stage, String(f.count), `${f.pct}%`]),
    });

    if (topClients.length) {
      autoTable(doc, {
        head: [["Top Client", "Revenue"]],
        body: topClients.map((c, i) => [`${i + 1}. ${c.name}`, formatUSD(c.total)]),
      });
    }

    doc.save(`report-${range}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <AppShell title={t("pages.reports.title")}>
      <div className="space-y-6">
        {/* Header / filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Insights across revenue, pipeline, and team performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as Range)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                  <SelectItem key={r} value={r}>{RANGE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={exportPDF} className="gap-2">
              <Download className="h-4 w-4" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Invoice summary stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={CheckCircle2} label="Paid" value={formatUSD(invSummary.paid)} tone="success" />
          <StatCard icon={AlertTriangle} label="Overdue" value={formatUSD(invSummary.overdue)} tone="destructive" />
          <StatCard icon={FileEdit} label="Draft" value={formatUSD(invSummary.draft)} tone="muted" />
          <StatCard icon={CheckSquareIcon} label="Task Completion" value={`${taskStats.pct}%`} hint={`${taskStats.done} of ${taskStats.total} this month`} tone="info" />
        </div>

        {/* Revenue Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Revenue Overview</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Earned <span className="font-semibold text-foreground">{formatUSD(totalEarned)}</span>
                {totalTarget > 0 && <> · Target <span className="font-semibold text-foreground">{formatUSD(totalTarget)}</span></>}
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
                    formatter={(v: number, k: string) => [formatUSD(v), k === "revenue" ? "Revenue" : "Target"]}
                  />
                  <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" fill="var(--info)" radius={[4, 4, 0, 0]} fillOpacity={0.4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lead Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Funnel</CardTitle>
              <p className="text-xs text-muted-foreground">Conversion rate: <span className="font-semibold text-foreground">{conversionRate}%</span></p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {funnelData.map((f, i) => {
                  const max = Math.max(...funnelData.map((x) => x.count), 1);
                  const width = (f.count / max) * 100;
                  // Funnel taper from 100% to ~40%
                  const indent = (i / (funnelData.length - 1)) * 30;
                  return (
                    <div key={f.stage} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground shrink-0">{f.stage}</div>
                      <div className="flex-1 h-9 bg-muted rounded-md relative overflow-hidden" style={{ marginLeft: `${indent}%`, marginRight: `${indent}%` }}>
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-warning transition-all"
                          style={{ width: `${Math.max(width, 4)}%` }}
                        />
                        <div className="relative flex items-center justify-between h-full px-3 text-xs font-medium">
                          <span>{f.count}</span>
                          <span className="text-muted-foreground">{f.pct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Win/Loss */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal Win / Loss</CardTitle>
              <p className="text-xs text-muted-foreground">
                Win rate: <span className="font-semibold text-foreground">
                  {wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0}%
                </span>
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Clients by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid invoices yet.</p>
            ) : (
              <ol className="space-y-2">
                {topClients.map((c, i) => {
                  const max = topClients[0].total || 1;
                  const w = (c.total / max) * 100;
                  return (
                    <li key={c.name} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium truncate">{c.name}</span>
                          <span className="text-sm font-semibold tabular-nums">{formatUSD(c.total)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-accent" style={{ width: `${w}%` }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon, label, value, hint, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; hint?: string;
  tone: "success" | "destructive" | "muted" | "info";
}) {
  const toneClass = {
    success: "text-success",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
    info: "text-info",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function CheckSquareIcon({ className }: { className?: string }) {
  return <CheckCircle2 className={className} />;
}
