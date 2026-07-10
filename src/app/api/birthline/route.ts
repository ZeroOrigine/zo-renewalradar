import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Public-safety filter for machine thoughts. Thoughts SHOULD never contain
 * secrets (the pipeline's deterministic gate scans for them) — but "should"
 * is not a security control. Belt + suspenders before anything hits the wire:
 * redact secret-shaped strings, emails, and connection URLs; truncate hard.
 */
function sanitizeThought(t: string | null): string | null {
  if (!t) return null;
  let x = t
    .replace(/(sk|re|ghp|gho|whsec|pk|rk)_[A-Za-z0-9_-]{8,}/g, '[redacted]')
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.?[A-Za-z0-9._-]*/g, '[redacted]')
    .replace(/AKIA[A-Z0-9]{12,}/g, '[redacted]')
    .replace(/xox[abpr]-[A-Za-z0-9-]{10,}/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]{12,}/gi, 'Bearer [redacted]')
    .replace(/(postgres|postgresql|mysql|redis|mongodb(\+srv)?):\/\/\S+/gi, '[redacted-url]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\s+/g, ' ')
    .trim();
  if (x.length > 220) x = x.slice(0, 220) + '…';
  return x;
}

const PUBLIC_MIND: Record<string, string> = {
  research_a: 'Research Mind A',
  research_b: 'Research Mind B',
  ethics: 'Ethics Mind',
  'build-architect': 'Pipeline Architect',
  builder: 'Builder Mind',
  builder_opus: 'Builder Mind',
  qa: 'QA Mind',
  marketing: 'Marketing Mind',
  immune_system: 'Immune System',
  retrospective: 'Evolution Mind',
};

// Statuses that mean "a product is physically on the line right now"
const STATION_OF: Record<string, number> = {
  building: 3,
  build_complete: 3,
  qa: 4,
  qa_round_1: 4,
  qa_round_2: 4,
  qa_round_3: 4,
  qa_fix_needed: 4,
  marketing: 5,
  deploying: 5,
};

// Halted ≠ gone: a paused product stays visible on the line, honestly labeled.
const HALTED_OF: Record<string, number> = {
  qa_infra_error: 4,
  qa_failed: 4,
  deploy_failed: 5,
  budget_halted: 3,
};

/**
 * The Birth Line — real-time position of the product currently being born.
 * Every number here is real: zo_projects (stage), zo_cost_logs (money),
 * zo_mind_logs (the machine's actual last thought).
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const active = [...Object.keys(STATION_OF), ...Object.keys(HALTED_OF)];

    const [{ data: projs }, { data: mindRows }] = await Promise.all([
      supabase
        .from('zo_projects')
        .select('project_id,name,status,created_at,updated_at')
        .in('status', active)
        .order('updated_at', { ascending: false })
        .limit(1),
      supabase
        .from('zo_mind_logs')
        .select('mind_name,action,output_summary,created_at,project_id')
        .order('created_at', { ascending: false })
        .limit(120),
    ]);

    const rows = mindRows ?? [];

    const p = (projs ?? [])[0] ?? null;
    let inflight = null;
    if (p) {
      const { data: costRows } = await supabase
        .from('zo_cost_logs')
        .select('cost_usd')
        .eq('project_id', p.project_id);
      const cost = (costRows ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
      const thought = rows.find((r) => r.project_id === p.project_id);
      inflight = {
        name: p.name,
        status: p.status,
        station: STATION_OF[p.status] ?? HALTED_OF[p.status] ?? 3,
        halted: p.status in HALTED_OF,
        since: p.updated_at,
        born: p.created_at,
        cost: Math.round(cost * 100) / 100,
        thought: sanitizeThought(thought ? (thought.output_summary || thought.action) : null),
        thoughtBy: thought?.mind_name ? (PUBLIC_MIND[thought.mind_name] ?? 'a Mind') : null,
        thoughtAt: thought?.created_at ?? null,
      };
    }

    let lastBirth = null;
    if (!inflight) {
      const { data: launched } = await supabase
        .from('zo_products')
        .select('name,created_at')
        .eq('status', 'live')
        .order('created_at', { ascending: false })
        .limit(1);
      lastBirth = (launched ?? [])[0] ?? null;
    }

    return NextResponse.json(
      { ok: true, inflight, lastBirth, at: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=20' } },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
