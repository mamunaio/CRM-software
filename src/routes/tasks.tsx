import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "@/components/SortableItem";
import { useOrderedIds } from "@/lib/dnd-order";

export const Route = createFileRoute("/tasks")({
  component: () => <RequireAuth><TasksPage /></RequireAuth>,
  head: () => ({ meta: [{ title: "Tasks — Pinnacle CRM" }] }),
});

type Task = {
  id: string; title: string; linked_contact_name: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done";
  due_date: string | null;
};

function TasksPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [pf, setPf] = useState("all");
  const [sf, setSf] = useState("all");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user!.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (t: Partial<Task> & { id?: string }) => {
      if (t.id) {
        const { error } = await supabase.from("tasks").update({
          title: t.title, linked_contact_name: t.linked_contact_name,
          priority: t.priority, status: t.status, due_date: t.due_date,
        }).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({
          user_id: user!.id, title: t.title!, linked_contact_name: t.linked_contact_name,
          priority: t.priority ?? "medium", status: t.status ?? "pending", due_date: t.due_date,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setOpen(false); setEditing(null); toast.success("Task saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleDone = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ status: done ? "done" : "pending" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Deleted"); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(
    () => tasks.filter((t) => {
      if (pf !== "all" && t.priority !== pf) return false;
      if (sf !== "all" && t.status !== sf) return false;
      return true;
    }),
    [tasks, pf, sf],
  );

  const allTaskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const [order, setOrder] = useOrderedIds(`task-order:${user!.id}`, allTaskIds);
  const orderIndex = useMemo(() => {
    const m = new Map<string, number>();
    order.forEach((id, i) => m.set(id, i));
    return m;
  }, [order]);
  const orderedFiltered = useMemo(
    () => [...filtered].sort((a, b) => (orderIndex.get(a.id) ?? 1e9) - (orderIndex.get(b.id) ?? 1e9)),
    [filtered, orderIndex],
  );
  const visibleIds = useMemo(() => orderedFiltered.map((t) => t.id), [orderedFiltered]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromVisible = visibleIds.indexOf(String(active.id));
    const toVisible = visibleIds.indexOf(String(over.id));
    if (fromVisible < 0 || toVisible < 0) return;
    // Reorder visible IDs
    const newVisible = arrayMove(visibleIds, fromVisible, toVisible);
    // Splice newVisible back into the full order, preserving non-visible items' relative positions
    const visibleSet = new Set(visibleIds);
    const next: string[] = [];
    let vi = 0;
    for (const id of order) {
      if (visibleSet.has(id)) {
        next.push(newVisible[vi++]);
      } else {
        next.push(id);
      }
    }
    setOrder(next);
  };

  return (
    <AppShell title={t("pages.tasks.title")}>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex gap-2">
          <Select value={pf} onValueChange={setPf}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sf} onValueChange={setSf}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Task</Button></DialogTrigger>
          <TaskDialog initial={editing} onSubmit={(t) => upsert.mutate({ ...t, id: editing?.id })} busy={upsert.isPending} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
              <div className="divide-y">
                {orderedFiltered.map((t) => {
                  const overdue = t.due_date && t.due_date < today && t.status !== "done";
                  return (
                    <SortableItem key={t.id} id={t.id}>
                      <div className={cn("flex items-center gap-3 pl-9 pr-4 py-3 hover:bg-muted/40", overdue && "bg-destructive/5")}>
                        <Checkbox
                          checked={t.status === "done"}
                          onCheckedChange={(v) => toggleDone.mutate({ id: t.id, done: !!v })}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={cn("font-medium text-sm", t.status === "done" && "line-through text-muted-foreground")}>
                            {t.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t.linked_contact_name ?? "No link"} · Due {formatDate(t.due_date)}
                            {overdue && <span className="text-destructive font-medium ml-2">Overdue</span>}
                          </div>
                        </div>
                        <StatusBadge value={t.priority} />
                        <StatusBadge value={t.status} />
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setOpen(true); }}>Edit</Button>
                        <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </SortableItem>
                  );
                })}
                {orderedFiltered.length === 0 && <div className="text-center py-8 text-muted-foreground">No tasks.</div>}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function TaskDialog({ initial, onSubmit, busy }: { initial: Task | null; onSubmit: (t: Partial<Task>) => void; busy: boolean }) {
  const [form, setForm] = useState<Partial<Task>>(
    initial ?? { title: "", linked_contact_name: "", priority: "medium", status: "pending", due_date: null },
  );
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Title *</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Linked client / lead</Label><Input value={form.linked_contact_name ?? ""} onChange={(e) => setForm({ ...form, linked_contact_name: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Due date</Label><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} /></div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(form)} disabled={busy || !form.title}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
