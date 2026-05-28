import { SupabaseClient } from "@supabase/supabase-js";
import { startSourcingRun, runSourcingStep, getSourcingRun, promoteFindings } from "./sourcing.functions";
import { researchLead } from "./research.functions";
import { sendEmail, draftEmail } from "./email.functions";
import { recomputeOne } from "./scoring.functions";

export async function runAutonomousEngine(supabase: SupabaseClient) {
  const { data: configs, error: cErr } = await supabase
    .from("automation_config")
    .select("*")
    .eq("enabled", true);

  if (cErr) {
    console.error("Failed to fetch automation configs:", cErr);
    return;
  }

  for (const config of configs || []) {
    try {
      await processUserAutomation(supabase, config);
    } catch (err) {
      console.error(`Automation failed for user ${config.user_id}:`, err);
    }
  }
}

async function processUserAutomation(supabase: SupabaseClient, config: any) {
  const userId = config.user_id;

  const { data: run, error: rErr } = await supabase
    .from("automation_runs")
    .insert({
      user_id: userId,
      status: "running",
      logs: [`Started autonomous loop at ${new Date().toISOString()}`] as any
    })
    .select("id")
    .single();

  if (rErr) throw rErr;
  const runId = run.id;

  const addLog = async (msg: string) => {
    try {
      const { data: currentRun } = await supabase.from("automation_runs").select("logs").eq("id", runId).single();
      const currentLogs = Array.isArray((currentRun as any)?.logs) ? (currentRun as any).logs : [];
      const newLogs = [...currentLogs, msg];
      await supabase.from("automation_runs").update({ logs: newLogs as any }).eq("id", runId);
    } catch (e) {
      console.error("Failed to add log:", e);
    }
  };

  try {
    // 1. Sourcing
    await addLog("Step: Sourcing new leads...");
    const sourcingRes = await (startSourcingRun as any).handler({
      data: { icp: config.icp },
      context: { supabase, userId }
    });

    await (runSourcingStep as any).handler({
      data: { runId: sourcingRes.runId },
      context: { supabase, userId }
    });

    const { findings } = await (getSourcingRun as any).handler({
      data: { runId: sourcingRes.runId },
      context: { supabase, userId }
    });

    if (findings && findings.length > 0) {
      const findingIds = findings.map((f: any) => f.id);
      await (promoteFindings as any).handler({
        data: { findingIds },
        context: { supabase, userId }
      });
      await addLog(`Sourced ${findings.length} new leads.`);
    } else {
      await addLog("No new leads found in this sourcing step.");
    }

    // 2. Research & Outreach
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(config.daily_lead_limit || 10);

    let researched = 0;
    let sent = 0;

    if (leads && leads.length > 0) {
      await addLog(`Processing ${leads.length} leads for research and outreach...`);
      for (const lead of leads) {
        try {
          const research = await (researchLead as any).handler({
            data: {
              lead,
              sender: {
                yourName: config.sender_name,
                yourCompany: config.sender_company,
                services: config.services_offered
              }
            },
            context: { supabase, userId }
          });

          researched++;

          const { score } = await (recomputeOne as any).handler({
            data: { leadId: lead.id },
            context: { supabase, userId }
          });

          await supabase.from("leads").update({
            notes: research.summary,
            score: score
          }).eq("id", lead.id);

          if (score >= 7 && lead.email) {
            const draft = await (draftEmail as any).handler({
              data: {
                lead,
                research,
                sender: {
                  yourName: config.sender_name,
                  yourCompany: config.sender_company,
                  yourTitle: config.sender_title
                }
              },
              context: { supabase, userId }
            });

            await (sendEmail as any).handler({
              data: {
                to: lead.email,
                subject: draft.subject,
                body: draft.body,
                leadId: lead.id
              },
              context: { supabase, userId }
            });
            sent++;
          }
        } catch (e) {
          console.error(`Failed to process lead ${lead.id}:`, e);
        }
      }
    }

    // Final update with current logs
    const { data: finalRun } = await supabase.from("automation_runs").select("logs").eq("id", runId).single();
    const finalLogs = Array.isArray((finalRun as any)?.logs) ? (finalRun as any).logs : [];

    await supabase.from("automation_runs").update({
      status: "completed",
      leads_sourced: findings?.length || 0,
      leads_researched: researched,
      emails_sent: sent,
      completed_at: new Date().toISOString(),
      logs: [...finalLogs, `Loop finished. Researched ${researched}, Sent ${sent}.`] as any
    }).eq("id", runId);

  } catch (err: any) {
    console.error("Autonomous engine error:", err);
    await supabase.from("automation_runs").update({
      status: "failed",
      error: err.message,
      completed_at: new Date().toISOString()
    }).eq("id", runId);
  }
}
