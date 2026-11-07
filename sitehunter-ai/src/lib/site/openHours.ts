// Aberto ou fechado agora, a partir das linhas de horário publicadas (as mesmas que o usuário edita)
// e do fuso horário local da empresa. Nada é presumido: linha que não dá para interpretar com segurança
// faz o site mostrar só os horários, sem afirmar aberto/fechado; sem linhas, "Horário não informado".

export type Interval = [number, number]; // minutos desde 0h; fim > 1440 = vira a noite
/** Domingo = 0 … sábado = 6. */
export type Schedule = Interval[][];

const DAY_WORDS: [RegExp, number][] = [
  [/^dom/, 0], [/^seg/, 1], [/^ter/, 2], [/^qua/, 3], [/^qui/, 4], [/^sex/, 5], [/^s[aá]b/, 6],
  [/^sun/, 0], [/^mon/, 1], [/^tue/, 2], [/^wed/, 3], [/^thu/, 4], [/^fri/, 5], [/^sat/, 6],
];
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const dayOf = (w: string): number | null => { const f = fold(w); return DAY_WORDS.find(([r]) => r.test(f))?.[1] ?? null; };

/** "Segunda a sexta", "Sábado e domingo", "Segunda, quarta", "Todos os dias", "Segunda a domingo, Feriados". */
export function parseDays(label: string): number[] | null {
  const l = fold(label).replace(/-feira/g, "");
  if (/^(todos os dias|diariamente|everyday|daily)$/.test(l)) return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<number>();
  for (const part of l.split(/\s*,\s*/)) {
    if (!part) continue;
    if (/^feriado/.test(part)) continue; // feriados não entram no cálculo (não sabemos quais são)
    const range = part.match(/^(\S+)\s+(?:a|ate|até|-|–)\s+(\S+)$/);
    const pair = part.match(/^(\S+)\s+e\s+(\S+)$/);
    if (range) {
      const a = dayOf(range[1]!), b = dayOf(range[2]!);
      if (a == null || b == null) return null;
      for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; }
    } else if (pair) {
      const a = dayOf(pair[1]!), b = dayOf(pair[2]!);
      if (a == null || b == null) return null;
      out.add(a); out.add(b);
    } else {
      const d = dayOf(part);
      if (d == null) return null;
      out.add(d);
    }
  }
  return out.size ? [...out].sort() : null;
}

function toMin(t: string): number | null {
  const m = fold(t).replace(/\s+/g, "").match(/^(\d{1,2})(?::|h)?(\d{2})?(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] ?? 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/** "09:00–18:00", "09:00–12:00 e 14:00–18:00", "18:00–02:00", "24 horas", "Fechado", "9:00 AM – 6:00 PM". */
export function parseTimes(value: string): Interval[] | "closed" | null {
  const v = fold(value);
  if (!v) return null;
  if (/^(fechado|closed)$/.test(v)) return "closed";
  if (/^(24 ?h(oras)?|aberto 24 horas|open 24 hours)$/.test(v)) return [[0, 1440]];
  const out: Interval[] = [];
  for (const part of v.split(/\s*(?:,|;|\be\b|\band\b)\s*/)) {
    if (!part) continue;
    const m = part.match(/^(.+?)(?:\s*[–—-]\s*|\s+(?:as|a|ate|to)\s+)(.+)$/);
    if (!m) return null;
    const a = toMin(m[1]!), b = toMin(m[2]!);
    if (a == null || b == null) return null;
    out.push([a, b <= a ? b + 1440 : b]); // fim antes do início = fecha depois da meia-noite
  }
  return out.length ? out : null;
}

/**
 * Agenda semanal a partir das linhas. Dias sem linha ficam fechados (convenção do OpenStreetMap e do
 * Google, que listam os dias abertos). Qualquer linha que não dê para interpretar → null (sem status).
 */
export function parseSchedule(lines: { label: string; value: string }[] | undefined | null): Schedule | null {
  const filled = (lines ?? []).filter((l) => l.value.trim());
  if (!filled.length) return null;
  const s: Schedule = [[], [], [], [], [], [], []];
  let anyDay = false;
  for (const l of filled) {
    if (/^feriado/.test(fold(l.label))) continue;
    const days = parseDays(l.label), times = parseTimes(l.value);
    if (!days || !times) return null;
    anyDay = true;
    for (const d of days) if (times !== "closed") s[d]!.push(...times);
  }
  return anyDay ? s : null;
}

export type OpenStatus =
  | { kind: "open"; closesAt: string; closesDay: string | null }
  | { kind: "closed"; opensAt: string | null; opensDay: string | null }
  | { kind: "unknown" }
  | { kind: "none" };

const DAY_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Dia da semana e minutos no fuso da empresa. */
export function localNow(date: Date, timeZone: string): { day: number; min: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, min: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function statusAt(schedule: Schedule | null, hasLines: boolean, date: Date, timeZone: string): OpenStatus {
  if (!hasLines) return { kind: "none" };
  if (!schedule) return { kind: "unknown" };
  const { day, min } = localNow(date, timeZone);
  // Aberto: intervalo de hoje ou intervalo de ontem que passou da meia-noite.
  for (const [a, b] of schedule[day]!) if (min >= a && min < b) return { kind: "open", closesAt: hhmm(b), closesDay: b > 1440 ? "amanhã" : null };
  for (const [a, b] of schedule[(day + 6) % 7]!) if (b > 1440 && min + 1440 >= a && min + 1440 < b) return { kind: "open", closesAt: hhmm(b), closesDay: null };
  // Próxima abertura nos próximos 7 dias.
  for (let k = 0; k < 8; k++) {
    const d = (day + k) % 7;
    const next = schedule[d]!.map(([a]) => a).filter((a) => k > 0 || a > min).sort((x, y) => x - y)[0];
    if (next != null) return { kind: "closed", opensAt: hhmm(next), opensDay: k === 0 ? null : k === 1 ? "amanhã" : DAY_PT[d]! };
  }
  return { kind: "closed", opensAt: null, opensDay: null };
}

/** Horário de hoje no fuso da empresa ("09:00–12:00 e 14:00–18:00" ou "Fechado hoje"). */
export function todayText(schedule: Schedule | null, date: Date, timeZone: string): string | null {
  if (!schedule) return null;
  const { day } = localNow(date, timeZone);
  const iv = [...schedule[day]!].sort((a, b) => a[0] - b[0]);
  if (!iv.length) return "Fechado hoje";
  if (iv.length === 1 && iv[0]![0] === 0 && iv[0]![1] === 1440) return "24 horas";
  return iv.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(" e ");
}

export function statusText(s: OpenStatus): string {
  if (s.kind === "none") return "Horário não informado";
  if (s.kind === "unknown") return "Confira os horários";
  if (s.kind === "open") return `Aberto agora · fecha às ${s.closesAt}${s.closesDay ? ` (${s.closesDay})` : ""}`;
  return s.opensAt ? `Fechado agora · abre ${s.opensDay ? `${s.opensDay} ` : ""}às ${s.opensAt}` : "Fechado";
}

// ---------- fuso horário local (IANA) ----------
const UF_TZ: Record<string, string> = {
  AC: "America/Rio_Branco", AM: "America/Manaus", RR: "America/Boa_Vista", RO: "America/Porto_Velho", MT: "America/Cuiaba", MS: "America/Campo_Grande",
  PA: "America/Belem", AP: "America/Belem", TO: "America/Araguaina", MA: "America/Fortaleza", PI: "America/Fortaleza", CE: "America/Fortaleza",
  RN: "America/Fortaleza", PB: "America/Fortaleza", PE: "America/Recife", AL: "America/Maceio", SE: "America/Maceio", BA: "America/Bahia",
  GO: "America/Sao_Paulo", DF: "America/Sao_Paulo", MG: "America/Sao_Paulo", ES: "America/Sao_Paulo", RJ: "America/Sao_Paulo", SP: "America/Sao_Paulo",
  PR: "America/Sao_Paulo", SC: "America/Sao_Paulo", RS: "America/Sao_Paulo",
};
const STATE_UF: Record<string, string> = {
  acre: "AC", amazonas: "AM", roraima: "RR", rondonia: "RO", "mato grosso": "MT", "mato grosso do sul": "MS", para: "PA", amapa: "AP", tocantins: "TO",
  maranhao: "MA", piaui: "PI", ceara: "CE", "rio grande do norte": "RN", paraiba: "PB", pernambuco: "PE", alagoas: "AL", sergipe: "SE", bahia: "BA",
  goias: "GO", "distrito federal": "DF", "minas gerais": "MG", "espirito santo": "ES", "rio de janeiro": "RJ", "sao paulo": "SP", parana: "PR",
  "santa catarina": "SC", "rio grande do sul": "RS",
};
/** Municípios do oeste do Amazonas no fuso UTC−5 (lei 12.876/2013) e Fernando de Noronha (UTC−2). */
const AM_WEST = new Set(["atalaia do norte", "benjamin constant", "boca do acre", "eirunepe", "envira", "guajara", "ipixuna", "itamarati", "jutai", "labrea", "pauini", "santo antonio do ica", "sao paulo de olivenca", "tabatinga"]);

export function ufOf(state: string | null | undefined): string | null {
  if (!state) return null;
  const s = state.trim();
  if (/^[A-Za-z]{2}$/.test(s) && UF_TZ[s.toUpperCase()]) return s.toUpperCase();
  return STATE_UF[fold(s)] ?? null;
}

export function timezoneFor(state: string | null | undefined, city?: string | null): string | null {
  const c = fold(city ?? "");
  if (c === "fernando de noronha") return "America/Noronha";
  const uf = ufOf(state);
  if (uf === "AM" && AM_WEST.has(c)) return "America/Eirunepe";
  return uf ? UF_TZ[uf]! : null;
}

/** Endereço salvo ("Rua X, 10 · Centro · Florianópolis · Santa Catarina"): cidade e estado nas últimas partes. */
export function timezoneFromAddress(address: string): string | null {
  const parts = address.split(/\s*[·,|-]\s*/).map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const tz = timezoneFor(parts[i], parts[i - 1]);
    if (tz) return tz;
  }
  return null;
}

/**
 * Atualiza o selo no navegador do visitante a cada minuto (serializado com toString no site gerado).
 * Recebe a agenda já interpretada no servidor; usa o relógio do visitante convertido para o fuso da empresa.
 */
export function hoursRuntime(cfg: { schedule: Schedule; tz: string }) {
  var DAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  function pad(n: number) { return (n < 10 ? "0" : "") + n; }
  function hm(m: number) { m = m % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function now() {
    var p = new Intl.DateTimeFormat("en-US", { timeZone: cfg.tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    var g = function (t: string) { for (var i = 0; i < p.length; i++) if (p[i]!.type === t) return p[i]!.value; return "0"; };
    return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday")), min: Number(g("hour")) * 60 + Number(g("minute")) };
  }
  function todayOf(n: { day: number; min: number }) {
    var iv = cfg.schedule[n.day]!.slice().sort(function (a, b) { return a[0] - b[0]; }), out = [], i;
    if (!iv.length) return "Fechado hoje";
    if (iv.length === 1 && iv[0]![0] === 0 && iv[0]![1] === 1440) return "24 horas";
    for (i = 0; i < iv.length; i++) out.push(hm(iv[i]![0]) + "–" + hm(iv[i]![1]));
    return out.join(" e ");
  }
  function compute() {
    var n = now(), s = cfg.schedule, i, k, td = todayOf(n);
    for (i = 0; i < s[n.day]!.length; i++) { var a = s[n.day]![i]!; if (n.min >= a[0] && n.min < a[1]) return { open: true, text: "Aberto agora · fecha às " + hm(a[1]) + (a[1] > 1440 ? " (amanhã)" : ""), day: n.day, today: td }; }
    var y = s[(n.day + 6) % 7]!;
    for (i = 0; i < y.length; i++) { var b = y[i]!; if (b[1] > 1440 && n.min + 1440 >= b[0] && n.min + 1440 < b[1]) return { open: true, text: "Aberto agora · fecha às " + hm(b[1]), day: n.day, today: td }; }
    for (k = 0; k < 8; k++) {
      var d = (n.day + k) % 7, best = -1;
      for (i = 0; i < s[d]!.length; i++) { var st = s[d]![i]![0]; if ((k > 0 || st > n.min) && (best < 0 || st < best)) best = st; }
      if (best >= 0) return { open: false, text: "Fechado agora · abre " + (k === 0 ? "" : k === 1 ? "amanhã " : DAYS[d] + " ") + "às " + hm(best), day: n.day, today: td };
    }
    return { open: false, text: "Fechado", day: n.day, today: td };
  }
  function paint() {
    var r = compute();
    document.querySelectorAll("[data-open-status]").forEach(function (el) {
      el.classList.toggle("is-open", r.open); el.classList.toggle("is-closed", !r.open);
      var t = el.querySelector("[data-open-text]"); if (t) t.textContent = r.text;
    });
    document.querySelectorAll("[data-today]").forEach(function (el) { el.textContent = r.today; });
    document.querySelectorAll("[data-days]").forEach(function (el) {
      var days = (el.getAttribute("data-days") || "").split(",");
      el.classList.toggle("is-today", days.indexOf(String(r.day)) >= 0);
    });
  }
  paint();
  setInterval(paint, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) paint(); });
}
