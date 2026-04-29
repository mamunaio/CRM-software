import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Briefcase, Plus, Trash2, Mail, Pencil, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: () => <RequireAuth><SettingsPage /></RequireAuth>,
  head: () => ({ meta: [{ title: "Settings — Pinnacle CRM" }] }),
});

function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user!.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
  });
  const { data: members = [] } = useQuery({
    queryKey: ["team_members", user!.id],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("*").order("name");
      return data ?? [];
    },
  });

  const [agencyName, setAgencyName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [newMember, setNewMember] = useState({ name: "", role: "Member", email: "" });

  useEffect(() => {
    if (profile) {
      setAgencyName(profile.agency_name);
      setTimezone(profile.timezone);
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        agency_name: agencyName, timezone,
      }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Settings saved"); },
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_members").insert({
        user_id: user!.id, name: newMember.name, role: newMember.role, email: newMember.email,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team_members"] }); setNewMember({ name: "", role: "Member", email: "" }); toast.success("Team member added"); },
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team_members"] }),
  });

  return (
    <AppShell title={t("pages.settings.title")}>
      <div className="grid gap-6 max-w-4xl">
        <Card>
          <CardHeader><CardTitle className="text-base">Agency Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                <Briefcase className="h-7 w-7" />
              </div>
              <Button variant="outline" size="sm" disabled>Upload logo (placeholder)</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Agency name</Label><Input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} /></div>
              <div><Label>Timezone</Label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
            </div>
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>Save changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Team Members</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Email</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.role}</TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeMember.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4 pt-4 border-t">
              <Input placeholder="Name" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} />
              <Input placeholder="Role" value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })} />
              <Input placeholder="Email" type="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} />
              <Button onClick={() => addMember.mutate()} disabled={!newMember.name || !newMember.email}>
                <Plus className="h-4 w-4 mr-1" /> Add member
              </Button>
            </div>
          </CardContent>
        </Card>

        <EmailTemplates />
      </div>
    </AppShell>
  );
}

type Template = { id: string; name: string; subject: string; body: string };

function EmailTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["email_templates", user!.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates").select("id,name,subject,body")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (t: Partial<Template> & { id?: string }) => {
      if (t.id) {
        const { error } = await supabase.from("email_templates")
          .update({ name: t.name, subject: t.subject, body: t.body }).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("email_templates").insert({
          user_id: user!.id, name: t.name!, subject: t.subject!, body: t.body!,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_templates"] });
      setOpen(false); setEditing(null);
      toast.success("Template saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email_templates"] }); toast.success("Deleted"); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-accent" /> Email Templates
        </CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Template</Button>
          </DialogTrigger>
          <TemplateDialog initial={editing} onSubmit={(t) => upsert.mutate({ ...t, id: editing?.id })} busy={upsert.isPending} />
        </Dialog>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet. Create reusable templates for follow-ups and proposals.</p>
        ) : (
          <div className="divide-y">
            {templates.map((t) => (
              <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">Subject: {t.subject}</div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{t.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" title="Copy body" onClick={() => {
                    navigator.clipboard.writeText(`Subject: ${t.subject}\n\n${t.body}`);
                    toast.success("Template copied");
                  }}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TemplateDialog({
  initial, onSubmit, busy,
}: { initial: Template | null; onSubmit: (t: Partial<Template>) => void; busy: boolean }) {
  const [form, setForm] = useState<Partial<Template>>(
    initial ?? { name: "", subject: "", body: "" },
  );
  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>{initial ? "Edit template" : "New email template"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name *</Label><Input placeholder="e.g. Follow-up after proposal" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Subject *</Label><Input placeholder="e.g. Following up on our proposal" value={form.subject ?? ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
        <div><Label>Body *</Label><Textarea rows={8} placeholder="Hi {{name}},&#10;&#10;Just following up…" value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">Tip: use placeholders like {"{{name}}"} or {"{{company}}"} to personalize later.</p>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(form)} disabled={busy || !form.name || !form.subject || !form.body}>Save template</Button>
      </DialogFooter>
    </DialogContent>
  );
}
