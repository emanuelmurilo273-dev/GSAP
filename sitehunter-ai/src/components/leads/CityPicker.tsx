"use client";
import { useEffect, useRef, useState } from "react";
import { UFS } from "@/lib/br/ufs";

type C = { ibge: number; name: string; uf: string; capital: boolean };

/** Estado + município (qualquer um dos 5.570) com autocompletar; aceita também texto livre. */
export function CityPicker({ value, uf, cityIbge, onChange }: { value: string; uf: string; cityIbge?: number; onChange: (v: { location: string; uf: string; cityIbge?: number }) => void }) {
  const [opts, setOpts] = useState<C[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) return;
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const q = cityIbge ? "" : value;
      if (!q.trim() && !uf) return setOpts([]);
      const r = await fetch(`/api/br/cities?q=${encodeURIComponent(q)}&uf=${uf}`).then((x) => x.json()).catch(() => ({ cities: [] }));
      setOpts(r.cities ?? []);
      setActive(0);
    }, 150);
  }, [value, uf, open, cityIbge]);

  const pick = (c: C) => {
    onChange({ location: `${c.name} - ${c.uf}`, uf: c.uf, cityIbge: c.ibge });
    setOpen(false);
  };

  return (
    <div className="grid grid-cols-[96px_1fr] gap-2">
      <label className="block">
        <span className="label">Estado</span>
        <select className="input" value={uf} onChange={(e) => { onChange({ location: "", uf: e.target.value, cityIbge: undefined }); setOpen(true); }} aria-label="Estado">
          <option value="">UF</option>
          {Object.entries(UFS).map(([k, n]) => <option key={k} value={k} title={n}>{k}</option>)}
        </select>
      </label>
      <label className="relative block">
        <span className="label">Cidade {cityIbge ? <span className="normal-case text-emerald-300">· município do IBGE</span> : null}</span>
        <input
          className="input"
          role="combobox"
          aria-expanded={open && opts.length > 0}
          aria-controls="city-list"
          aria-autocomplete="list"
          required
          minLength={2}
          maxLength={120}
          placeholder="Qualquer cidade do Brasil"
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { onChange({ location: e.target.value, uf, cityIbge: undefined }); setOpen(true); }}
          onKeyDown={(e) => {
            if (!open || !opts.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(opts.length - 1, a + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === "Enter") { e.preventDefault(); pick(opts[active]!); }
          }}
        />
        {open && opts.length > 0 && (
          <ul id="city-list" role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-white/10 bg-ink-900 p-1 shadow-2xl">
            {opts.map((c, i) => (
              <li key={c.ibge} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(c); }} onMouseEnter={() => setActive(i)} className={`flex cursor-pointer justify-between rounded-lg px-3 py-2 text-sm ${i === active ? "bg-white/10 text-white" : "text-slate-300"}`}>
                <span>{c.name}{c.capital ? <span className="ml-1 text-xs text-slate-500">capital</span> : null}</span><span className="text-xs text-slate-500">{c.uf}</span>
              </li>
            ))}
          </ul>
        )}
      </label>
    </div>
  );
}
