import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_app/playbook")({ component: Playbook });

const SECTIONS = [
  {
    title: "Pipeline stages",
    items: [
      ["New", "Cold prospects — no contact yet. Goal: open the conversation."],
      ["Contacted", "First touch sent, no reply. Goal: follow up 2-3 times with new angles."],
      ["Engaged", "They opened, clicked, or replied. Goal: book a call."],
      ["Meeting", "Call booked. Goal: confirm, prep, show up."],
      ["Won", "Closed. Goal: onboard fast, ask for referrals."],
      ["Lost", "Dead. Goal: archive, revisit in 90 days."],
    ],
  },
  {
    title: "The 80/20 of cold email",
    items: [
      ["Deliverability first", "Land in inbox or nothing else matters. See the Deliverability tab."],
      ["Specific opener", "First line must reference THEM — a number, a launch, a hire. Never 'I came across your profile'."],
      ["One ask", "Each email asks for exactly one thing. Reply, click, 15-min call. Never two."],
      ["Short", "Under 80 words. Mobile-first. Whitespace > paragraphs."],
      ["Follow up 3x", "Most replies come on follow-up #2. Don't quit after one."],
    ],
  },
  {
    title: "Subject line rules",
    items: [
      ["Under 50 chars", "Mobile previews cut off after 40-50 chars."],
      ["Lowercase, no caps", "Looks more personal, less marketing."],
      ["No spam triggers", "Avoid 'FREE', '!!!', '$$$', 'limited time', 'act now'."],
      ["Test 3-5 variants", "Use the Subject Lines AI tool in Email Drafter."],
    ],
  },
  {
    title: "Volume & timing",
    items: [
      ["30-50/inbox/day", "Above this, deliverability tanks fast on cold domains."],
      ["Tuesday-Thursday, 9-11am local", "Highest open rates."],
      ["Wait 3-4 days between follow-ups", "Faster feels desperate, slower feels forgotten."],
      ["Stop after step 4", "Diminishing returns. Better to revisit in 90 days."],
    ],
  },
];

function Playbook() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Playbook" description="The cold email rules of the road, distilled." />
      {SECTIONS.map((s) => (
        <Card key={s.title}>
          <CardHeader><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {s.items.map(([term, def]) => (
                <div key={term} className="grid grid-cols-[140px_1fr] gap-3">
                  <dt className="text-sm font-medium">{term}</dt>
                  <dd className="text-sm text-muted-foreground">{def}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
