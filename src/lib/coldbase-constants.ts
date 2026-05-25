export const INDUSTRIES = ['E-commerce','Real Estate','Marketing Agency','B2B SaaS','Healthcare','Construction','Logistics','Financial Services','Legal','Education','Restaurant/Food','Retail','Manufacturing','Consulting','HR/Recruiting'];
export const JOB_TITLES = ['CEO','Founder','Co-Founder','COO','CTO','VP Operations','Director of Marketing','Head of Sales','Operations Manager','Marketing Manager','Business Owner','Managing Director','Partner','President','General Manager'];
export const COMPANY_SIZES = ['1-10','11-50','51-200','201-500','500+'];
export const COUNTRIES = ['United States','United Kingdom','Canada','Australia','Germany','Netherlands','Sweden','Denmark','France','Singapore','UAE','South Africa','Nigeria','Kenya','Ghana'];
export const NICHES = ['AI Automation','Website Design','App Development','SEO Services','PPC/Ads Management','Video Production','Content Marketing','Accounting','Insurance','Fitness/Wellness','Law Firm','Dental Practice','Real Estate Agency','E-commerce Brand','SaaS Platform'];

export const STATUSES = ["new","contacted","engaged","meeting","won","lost"] as const;
export const STATUS_LABELS: Record<string, string> = { new:'New', contacted:'Contacted', engaged:'Engaged', meeting:'Meeting', won:'Won', lost:'Lost' };
export const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  contacted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  engaged: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  meeting: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  won: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  lost: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

export const EMAIL_PATTERNS = [
  { id:'first.last', label:'first.last', fn:(f:string,l:string)=>`${f}.${l}` },
  { id:'firstlast', label:'firstlast', fn:(f:string,l:string)=>`${f}${l}` },
  { id:'first_last', label:'first_last', fn:(f:string,l:string)=>`${f}_${l}` },
  { id:'flast', label:'flast', fn:(f:string,l:string)=>`${f[0]||''}${l}` },
  { id:'firstl', label:'firstl', fn:(f:string,l:string)=>`${f}${l[0]||''}` },
  { id:'first-last', label:'first-last', fn:(f:string,l:string)=>`${f}-${l}` },
  { id:'first', label:'first', fn:(f:string,_l:string)=>f },
  { id:'last', label:'last', fn:(_f:string,l:string)=>l },
  { id:'f.last', label:'f.last', fn:(f:string,l:string)=>`${f[0]||''}.${l}` },
  { id:'first.l', label:'first.l', fn:(f:string,l:string)=>`${f}.${l[0]||''}` },
];

export function genEmails(first: string, last: string, domain: string) {
  const f = first.trim().toLowerCase().replace(/[^a-z]/g, '');
  const l = last.trim().toLowerCase().replace(/[^a-z]/g, '');
  const d = domain.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0].split('?')[0];
  if (!f || !l || !d) return [];
  return EMAIL_PATTERNS.map((p) => ({ id: p.id, label: p.label, email: `${p.fn(f, l)}@${d}` }));
}

export function copyText(t: string) {
  try { navigator.clipboard.writeText(t); }
  catch {
    const el = document.createElement('textarea');
    el.value = t; document.body.appendChild(el); el.select();
    document.execCommand('copy'); document.body.removeChild(el);
  }
}

export function csvExport(rows: (string | number | null | undefined)[][], filename: string) {
  const csv = rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = filename; a.click();
}

export function pct(a: number, b: number) { return b === 0 ? 0 : Math.round((a / b) * 100); }
export function fmt(n: number) { return n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + n; }

export const NICHE_TEMPLATES: Record<string, { name: string; steps: { day: number; subject: string; body: string }[] }> = {
  "AI Automation": {
    name: "AI Automation Outreach",
    steps: [
      { day: 0, subject: "{{company}}'s {{specific_process}} bottleneck", body: "Hi {{first_name}},\n\nNoticed {{company}} is scaling — most {{company_type}} hit a wall around {{specific_process}}. We just helped a {{similar_industry}} brand cut {{task}} time by 73% with one AI workflow.\n\nWorth a 15-min look?\n\n{{your_name}}" },
      { day: 3, subject: "re: {{specific_process}}", body: "Hi {{first_name}},\n\nQuick follow-up — did the note about {{specific_process}} get buried? Happy to send a 2-min loom showing exactly how it works.\n\n{{your_name}}" },
      { day: 7, subject: "{{agent_count}} agents instead of 1 hire", body: "Hi {{first_name}},\n\nOne more angle: instead of hiring for {{specific_role}}, we deploy {{agent_count}} AI agents that handle {{process}} 24/7. Same cost as 1 junior, 10x the output.\n\nInterested?\n\n{{your_name}}" },
      { day: 14, subject: "Closing the loop", body: "Hi {{first_name}},\n\nClosing the file on this — if {{specific_process}} ever becomes a priority, just reply 'restart' and I'll pick it back up.\n\nAll the best,\n{{your_name}}" },
    ],
  },
  "Website Design": {
    name: "Web Design Outreach",
    steps: [
      { day: 0, subject: "{{company}}'s site vs. competitors", body: "Hi {{first_name}},\n\nRan {{company}}'s site through our conversion audit. Found 3 quick wins — could push your demo signups +30% in 2 weeks.\n\nWant the report?\n\n{{your_name}}" },
      { day: 3, subject: "Audit ready", body: "Hi {{first_name}},\n\nThe audit's ready when you are. Should I send it over?\n\n{{your_name}}" },
      { day: 7, subject: "Last try", body: "Hi {{first_name}},\n\nClosing the loop. The 3 wins are still there — most {{company_type}} we work with see results in 14 days. Worth a quick chat?\n\n{{your_name}}" },
      { day: 14, subject: "All good", body: "Hi {{first_name}},\n\nWon't keep chasing — just reply if it ever becomes a priority.\n\n{{your_name}}" },
    ],
  },
  "SEO Services": {
    name: "SEO Outreach",
    steps: [
      { day: 0, subject: "{{company}} is ranking #14 for [keyword]", body: "Hi {{first_name}},\n\n{{company}} is on page 2 for the keyword that matters most in {{company_type}}. The brands on page 1 are getting 8x your organic traffic.\n\nWant a 5-min loom showing exactly how to close the gap?\n\n{{your_name}}" },
      { day: 3, subject: "re: ranking gap", body: "Hi {{first_name}},\n\nDid the loom get buried? Happy to resend.\n\n{{your_name}}" },
      { day: 7, subject: "One last thing", body: "Hi {{first_name}},\n\nNoticed {{company}} also has 4 fixable technical SEO issues. I included those in the loom — worth 10 min?\n\n{{your_name}}" },
      { day: 14, subject: "Closing the file", body: "Hi {{first_name}},\n\nWon't follow up again. Reply 'restart' anytime.\n\n{{your_name}}" },
    ],
  },
};
