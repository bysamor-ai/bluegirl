// 測試專用：記憶體版 Supabase fake，會真係按 .eq 過濾，先測得到租戶隔離。
type Row = Record<string, unknown>;

export function createFakeDb() {
  const db: Record<string, Row[]> = {};
  const calls: { table: string; op: string; payload?: unknown; filters: [string, unknown][] }[] = [];
  const failures = new Set<string>();

  function builder(table: string) {
    let op = "select";
    let payload: unknown;
    const filters: [string, unknown][] = [];
    let single: "maybe" | null = null;

    const run = () => {
      calls.push({ table, op, payload, filters: [...filters] });
      if (failures.has(table)) return { data: null, error: { message: "SECRET_DB_DETAIL" } };
      const rows = db[table] ?? (db[table] = []);
      if (op === "insert") {
        rows.push(...((Array.isArray(payload) ? payload : [payload]) as Row[]));
        return { data: null, error: null };
      }
      const out = rows.filter((r) => filters.every(([k, v]) => r[k] === v));
      return single === "maybe" ? { data: out[0] ?? null, error: null } : { data: out, error: null };
    };

    const b: Record<string, unknown> = {
      select: () => b,
      insert: (p: unknown) => { op = "insert"; payload = p; return b; },
      eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
      maybeSingle: () => { single = "maybe"; return b; },
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve().then(run).then(res, rej),
    };
    return b;
  }

  return {
    db,
    calls,
    failures,
    client: { from: (t: string) => builder(t) },
    reset() {
      for (const k of Object.keys(db)) delete db[k];
      calls.length = 0;
      failures.clear();
    },
  };
}
