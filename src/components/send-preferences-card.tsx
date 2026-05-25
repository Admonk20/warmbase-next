import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Save } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getSendPreferences, saveSendPreferences } from "@/lib/send-prefs.functions";

export function SendPreferencesCard() {
  const getFn = useServerFn(getSendPreferences);
  const saveFn = useServerFn(saveSendPreferences);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["send-prefs"], queryFn: () => getFn() });

  const [startH, setStartH] = useState(9);
  const [endH, setEndH] = useState(17);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [tz, setTz] = useState("UTC");
  const [throttle, setThrottle] = useState(60);
  const [holidays, setHolidays] = useState("");

  useEffect(() => {
    const p = data?.prefs as any;
    if (!p) return;
    setStartH(p.send_start_hour);
    setEndH(p.send_end_hour);
    setSkipWeekends(!!p.skip_weekends);
    setTz(p.default_timezone);
    setThrottle(p.throttle_seconds);
    setHolidays((p.holiday_dates ?? []).join(", "));
  }, [data]);

  async function save() {
    try {
      const holiday_dates = holidays.split(/[,\s]+/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
      await saveFn({ data: {
        send_start_hour: startH, send_end_hour: endH, skip_weekends: skipWeekends,
        default_timezone: tz, throttle_seconds: throttle, holiday_dates,
      } });
      qc.invalidateQueries({ queryKey: ["send-prefs"] });
      toast.success("Send preferences saved");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="size-4" /> Sending window</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Outbound sends respect this window. Weekend/holiday skips and per-lead best-hour optimization are applied automatically.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><Label>Start hour</Label><Input type="number" min={0} max={23} value={startH} onChange={(e) => setStartH(Number(e.target.value))} /></div>
          <div><Label>End hour</Label><Input type="number" min={1} max={24} value={endH} onChange={(e) => setEndH(Number(e.target.value))} /></div>
          <div><Label>Timezone</Label><Input value={tz} onChange={(e) => setTz(e.target.value)} placeholder="UTC" /></div>
          <div><Label>Throttle (s)</Label><Input type="number" min={0} max={3600} value={throttle} onChange={(e) => setThrottle(Number(e.target.value))} /></div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={skipWeekends} onCheckedChange={setSkipWeekends} id="skip-wkd" />
          <Label htmlFor="skip-wkd" className="cursor-pointer">Skip weekends</Label>
        </div>
        <div className="space-y-1.5">
          <Label>Holidays (YYYY-MM-DD, comma-separated)</Label>
          <Input value={holidays} onChange={(e) => setHolidays(e.target.value)} placeholder="2026-01-01, 2026-12-25" />
        </div>
        <Button onClick={save}><Save className="size-4" /> Save</Button>
      </CardContent>
    </Card>
  );
}
