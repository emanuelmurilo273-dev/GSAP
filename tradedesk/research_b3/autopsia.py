"""AUTÓPSIA do robô: expectativa por operação, custos, recortes (ativo/horário/dia/regime/lado/saída), as 20 piores, integridade e veredito.

Uso (rode no PC onde está o painel — só lá existem os SEUS trades):
    python -m research_b3.autopsia --supabase              # lê b3_trades/b3_decisions do seu Supabase (SUPABASE_URL e SUPABASE_KEY no ambiente)
    python -m research_b3.autopsia --json trades.json      # ou um arquivo exportado
    python -m research_b3.autopsia --sim 60 --seeds 1 2 3  # estudo no simulador interno (preços ARTIFICIAIS), antes × depois das regras v2
Escreve DIAGNOSTICO.md (ou --out). Não altera nada no banco.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "connector"))
SP = ZoneInfo("America/Sao_Paulo")
BRL_PT = {"WIN": 0.20, "WDO": 10.0}
TICK = {"WIN": 5.0, "WDO": 0.5}
FEE_PLACEHOLDER = {"WIN": 0.50, "WDO": 2.00}     # R$/contrato ida e volta — PLACEHOLDER até confirmar na Clear
DOW = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
MIN_N = 30


# ───────────────────────── utilidades ─────────────────────────
def to_sp(iso: str) -> datetime:
    return datetime.fromisoformat(str(iso).replace("Z", "+00:00")).astimezone(SP)


def mean(x): return sum(x) / len(x) if x else 0.0


def sd(x): return statistics.stdev(x) if len(x) > 1 else 0.0


def pf(pnls):
    w, l = sum(p for p in pnls if p > 0), -sum(p for p in pnls if p < 0)
    return w / l if l > 0 else (math.inf if w > 0 else None)


def ci95(x):
    """Intervalo de 95% da média (aprox. normal). Com poucos trades NÃO é prova de nada."""
    if len(x) < 2:
        return (None, None)
    h = 1.96 * sd(x) / math.sqrt(len(x))
    return (mean(x) - h, mean(x) + h)


def brl(v, d=2):
    return "—" if v is None else f"R$ {v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fnum(v, d=2):
    return "—" if v is None else ("∞" if v == math.inf else f"{v:.{d}f}".replace(".", ","))


# ───────────────────────── enriquecimento dos trades ─────────────────────────
def enrich(trades: list[dict], decisions: list[dict] | None = None) -> list[dict]:
    decs = []
    for d in decisions or []:
        try:
            decs.append((to_sp(d["ts"]), d.get("symbol", ""), d.get("regime"), d.get("decision")))
        except Exception:
            pass
    out = []
    for t in trades:
        if t.get("status") != "closed" or t.get("pnl") is None:
            continue
        r = dict(t)
        root = t.get("root") or str(t.get("contract", ""))[:3]
        r["root"] = root
        o = to_sp(t["opened_at"])
        r["open_dt"], r["day"] = o, o.date().isoformat()
        r["slot"] = f"{o.hour:02d}:{(o.minute // 30) * 30:02d}"
        r["dow"] = DOW[o.weekday()]
        r["net"] = float(t["pnl"])
        vol = float(t.get("volume") or 1)
        fees = t.get("fees")
        r["fees_est"] = fees is None
        r["fees_v"] = float(fees) if fees is not None else FEE_PLACEHOLDER.get(root, 0.0) * vol
        r["gross"] = float(t["gross_pnl"]) if t.get("gross_pnl") is not None else r["net"] + r["fees_v"]
        bp, tk = BRL_PT.get(root, 1.0), TICK.get(root, 1.0)
        sgn = 1 if t["side"] == "buy" else -1
        slip = 0.0
        if t.get("price_signal") is not None:                       # derrapagem de entrada (contra o robô)
            slip += max(0.0, (float(t["price_open"]) - float(t["price_signal"])) * sgn) * bp * vol
        # saída
        pc, sl, tp = t.get("price_close"), t.get("sl"), t.get("tp")
        reason = str(t.get("close_reason") or "")
        ex = "outro"
        if "fim de dia" in reason: ex = "zeragem de fim de dia"
        elif "limite" in reason or "meta" in reason: ex = "limite diário"
        elif "PARAR" in reason or "troca de modo" in reason or "sem stop" in reason: ex = "parada manual/segurança"
        elif pc is not None and sl is not None and tp is not None:
            ds, dt_ = abs(float(pc) - float(sl)), abs(float(pc) - float(tp))
            ex = "stop" if ds <= dt_ else "alvo"
            if ex == "stop":
                slip += max(0.0, (float(sl) - float(pc)) * sgn) * bp * vol   # saiu pior que o gatilho
        r["exit"], r["slip_v"] = ex, slip
        r["gross_all"] = r["gross"] + slip      # o preço de fill já traz a derrapagem: somando de volta temos o resultado "sem nenhum custo"
        r["regime_v"] = t.get("regime")
        if not r["regime_v"] and decs:
            best = min(((abs((o - d[0]).total_seconds()), d[2]) for d in decs if d[1][:3] == root and d[3] == "entrou"), default=(1e9, None))
            r["regime_v"] = best[1] if best[0] < 600 else None
        r["regime_v"] = r["regime_v"] or "desconhecido"
        r["rr_real"] = None
        r["stop_brl"] = float(t["stop_points"]) * bp * vol if t.get("stop_points") else None
        out.append(r)
    out.sort(key=lambda r: r["open_dt"])
    return out


# ───────────────────────── métricas ─────────────────────────
def metrics(rs: list[dict], key: str = "net") -> dict:
    x = [r[key] for r in rs]
    w, l = [v for v in x if v > 0], [v for v in x if v < 0]
    n = len(x)
    lo, hi = ci95(x)
    return {"n": n, "win": len(w) / n if n else 0, "avg_win": mean(w), "avg_loss": -mean(l) if l else 0.0, "expect": mean(x), "pf": pf(x),
            "total": sum(x), "ci": (lo, hi), "sig_neg": hi is not None and hi < 0 and n >= MIN_N, "sig_pos": lo is not None and lo > 0 and n >= MIN_N}


def breakeven(rs: list[dict]) -> list[dict]:
    """Acerto necessário para empatar, dado o stop, o alvo (rr) e o custo por operação — por ativo."""
    out = []
    for root in sorted({r["root"] for r in rs}):
        g = [r for r in rs if r["root"] == root and r.get("stop_brl")]
        if not g:
            continue
        risk = mean([r["stop_brl"] for r in g])
        cost = mean([r["fees_v"] + r["slip_v"] + (TICK.get(root, 1) * BRL_PT.get(root, 1) * float(r.get("volume") or 1)) * 0 for r in g])
        rr = 1.5
        c = cost / risk if risk else 0
        out.append({"root": root, "risk": risk, "cost": cost, "c": c, "p_be": (1 + c) / (1 + rr), "p_rw": 1 / (1 + rr), "e_rw": (1 / (1 + rr)) * rr - (1 - 1 / (1 + rr)) - c})
    return out


def group(rs, keyf):
    d = defaultdict(list)
    for r in rs:
        d[keyf(r)].append(r)
    return d


def suggest_blocks(rs: list[dict]) -> list[str]:
    """Só sugere bloquear um recorte com PROVA: ≥30 trades e o limite superior do intervalo de 95% da expectativa < 0."""
    sug = []
    for name, kf in (("ativo", lambda r: r["root"]), ("horário", lambda r: r["slot"]), ("lado", lambda r: r["side"]), ("regime", lambda r: r["regime_v"])):
        for k, g in group(rs, kf).items():
            m = metrics(g)
            if m["sig_neg"]:
                sug.append(f"{name} **{k}**: {m['n']} operações, expectativa {brl(m['expect'])}/operação (IC95% {brl(m['ci'][0])} a {brl(m['ci'][1])})")
    return sug


def verdict(rs: list[dict]) -> dict:
    """Primeiros 70% dos trades = 'dentro da amostra'; últimos 30% = 'fora da amostra' (o que vale)."""
    k = int(len(rs) * 0.7)
    ins, oos = rs[:k], rs[k:]
    a, b = metrics(ins), metrics(oos)
    if len(oos) < 100:
        status, txt = "SEM PROVA", f"só {len(oos)} operações fora da amostra (precisa de ≥100). Não dá para afirmar vantagem."
    elif b["expect"] <= 0:
        status, txt = "SEM VANTAGEM", "a expectativa fora da amostra é zero ou negativa: **a estratégia não tem vantagem**."
    elif b["sig_pos"]:
        status, txt = "COM VANTAGEM", "expectativa fora da amostra positiva e estatisticamente acima de zero."
    else:
        status, txt = "SEM PROVA", "expectativa fora da amostra positiva, mas dentro da margem de erro (pode ser sorte)."
    return {"status": status, "text": txt, "in": a, "out": b}


# ───────────────────────── integridade (bugs de execução) ─────────────────────────
def integrity(raw: list[dict], settings: dict | None = None) -> list[tuple[str, str]]:
    """Lista de (ok|ALERTA, mensagem). Procura ordem duplicada, stop ausente, posição esquecida, abertura proibida, estouro do limite."""
    res: list[tuple[str, str]] = []
    st = settings or {}
    tk = defaultdict(int)
    for t in raw:
        if t.get("ticket") is not None:
            tk[(t["ticket"], t.get("seed"))] += 1
    dup = [k[0] for k, v in tk.items() if v > 1]
    res.append(("ALERTA" if dup else "ok", f"tickets duplicados: {dup[:5]}" if dup else "nenhum ticket duplicado"))
    nosl = [t for t in raw if not t.get("sl")]
    res.append(("ALERTA" if nosl else "ok", f"{len(nosl)} operação(ões) SEM stop gravado" if nosl else "toda operação tem stop gravado"))
    forgot = [t for t in raw if t.get("status") == "open" and (datetime.now(SP) - to_sp(t["opened_at"])).total_seconds() > 86400]
    res.append(("ALERTA" if forgot else "ok", f"{len(forgot)} posição(ões) aberta(s) há mais de 24 h (esquecida?)" if forgot else "nenhuma posição esquecida"))
    cl = [t for t in raw if t.get("status") == "closed"]
    noclose = [t for t in cl if t.get("price_close") is None or t.get("pnl") is None]
    res.append(("ALERTA" if noclose else "ok", f"{len(noclose)} operação(ões) fechada(s) sem preço/resultado (histórico do MT5 não encontrado)" if noclose else "toda saída tem preço e resultado"))
    early = [t for t in raw if to_sp(t["opened_at"]).time() < datetime(2000, 1, 1, 9, 15).time()]
    res.append(("ALERTA" if early else "ok", f"{len(early)} entrada(s) nos primeiros 15 min do pregão" if early else "nenhuma entrada nos primeiros 15 min"))
    byday = defaultdict(list)
    for t in raw:
        byday[(to_sp(t["opened_at"]).date(), t.get("source"), t.get("mode"), t.get("seed"))].append(t)
    mx = st.get("max_trades_per_day")
    over = [(k[0].isoformat(), len(v)) for k, v in byday.items() if mx and len(v) > mx]
    res.append(("ALERTA" if over else "ok", f"dias acima do limite de {mx} operações: {over[:3]}" if over else "limite de operações por dia respeitado"))
    lim = st.get("daily_loss_brl")
    ov = []
    for k, v in byday.items():
        p = sum(float(t.get("pnl") or 0) for t in v if t.get("status") == "closed")
        if lim and p < -1.5 * float(lim):
            ov.append((k[0].isoformat(), round(p, 2)))
    res.append(("ALERTA" if ov else "ok", f"dias que estouraram o limite de perda em mais de 50%: {ov[:3]}" if ov else "limite de perda diário nunca estourou em mais de 50%"))
    dbl = []
    s2 = sorted(raw, key=lambda t: (t.get("seed") or 0, t["opened_at"]))
    for a, b in zip(s2, s2[1:]):
        if a.get("contract") == b.get("contract") and a["side"] == b["side"] and abs((to_sp(b["opened_at"]) - to_sp(a["opened_at"])).total_seconds()) < 5 and a.get("source") == b.get("source") and a.get("seed") == b.get("seed"):
            dbl.append(a["opened_at"][:19])
    res.append(("ALERTA" if dbl else "ok", f"ordens possivelmente duplicadas (mesmo lado/contrato em <5 s): {dbl[:3]}" if dbl else "nenhuma ordem duplicada em <5 s"))
    ovl = 0
    for root in {t.get("root") for t in raw}:
        g = sorted([t for t in cl if t.get("root") == root and t.get("closed_at")], key=lambda t: (t.get("seed") or 0, t["opened_at"]))
        for a, b in zip(g, g[1:]):
            if a.get("source") == b.get("source") and a.get("seed") == b.get("seed") and to_sp(b["opened_at"]) < to_sp(a["closed_at"]):
                ovl += 1
    res.append(("ALERTA" if ovl else "ok", f"{ovl} sobreposição(ões) de posição no mesmo ativo (regra: 1 por ativo)" if ovl else "nunca duas posições ao mesmo tempo no mesmo ativo"))
    return res


# ───────────────────────── pior operação: "o que deveria ter feito" ─────────────────────────
def lessons(r: dict, prev_losses: int) -> list[str]:
    out = []
    atr = r.get("atr_pts")
    sp = float(r["stop_points"]) if r.get("stop_points") else None
    if atr and sp and sp < atr:
        out.append(f"stop de {sp:.0f} pts menor que 1 ATR ({atr:.0f} pts): o ruído normal do mercado derrubou")
    elif not atr and sp:
        out.append(f"stop FIXO de {sp:.0f} pts (não olha a volatilidade do momento)")
    if r["regime_v"] == "lateral":
        out.append("cruzamento de médias em mercado lateral costuma falhar (vai e volta)")
    if r["regime_v"] == "volatil":
        out.append("mercado muito agitado: stop e preço de entrada ficam instáveis")
    if r["open_dt"].time() < datetime(2000, 1, 1, 9, 15).time():
        out.append("entrou nos primeiros 15 min (leilão/gap/spread largo)")
    if r["exit"] == "zeragem de fim de dia" and r["net"] < 0:
        out.append("ficou o dia todo sem bater stop nem alvo e foi zerado no fim")
    if prev_losses >= 2:
        out.append(f"já vinha de {prev_losses} perdas seguidas no dia: deveria ter parado")
    if r["fees_v"] + r["slip_v"] > 0.15 * abs(r["net"]) and r["net"] < 0:
        out.append(f"custos de {brl(r['fees_v'] + r['slip_v'])} pesaram ({(r['fees_v'] + r['slip_v']) / abs(r['net']) * 100:.0f}% da perda)")
    return out or ["perda normal dentro do risco previsto (stop acionado); não há erro evidente"]


# ───────────────────────── relatório ─────────────────────────
def table(rows: list[list], head: list[str]) -> str:
    lines = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    lines += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(lines)


def mrow(label, m, flags=True):
    flag = "" if not flags else " 🔴" if m["sig_neg"] else (" 🟢" if m["sig_pos"] else "")
    return [label, m["n"], f"{m['win'] * 100:.0f}%", brl(m["avg_win"]), brl(m["avg_loss"]), brl(m["expect"]) + flag, fnum(m["pf"]), brl(m["total"], 0)]


MHEAD = ["", "ops", "acerto", "ganho médio", "perda média", "expectativa/op", "fator de lucro", "resultado"]


def breakdown(rs, title, keyf, order=None, flags=True):
    g = group(rs, keyf)
    keys = order or sorted(g)
    rows = [mrow(str(k), metrics(g[k]), flags) for k in keys if k in g]
    return f"### {title}\n\n" + table(rows, [title.split(' ')[0].capitalize()] + MHEAD[1:]) + "\n"


def section(rs: list[dict], raw: list[dict], title: str, settings: dict | None = None, deep: bool = True) -> str:
    if not rs:
        return f"## {title}\n\nSem operações fechadas.\n"
    m = metrics(rs)
    g = metrics(rs, "gross_all")
    fees = sum(r["fees_v"] for r in rs)
    slip = sum(r["slip_v"] for r in rs)
    days = len({r["day"] for r in rs})
    o = [f"## {title}\n"]
    o.append(f"**{m['n']} operações em {days} pregões.**\n")
    o.append("### Expectativa matemática por operação\n")
    lo, hi = m["ci"]
    o.append(f"`expectativa = %acerto × ganho médio − %erro × perda média`\n\n"
             f"= {m['win'] * 100:.1f}% × {brl(m['avg_win'])} − {(1 - m['win']) * 100:.1f}% × {brl(m['avg_loss'])} = **{brl(m['expect'])} por operação** "
             f"(fator de lucro {fnum(m['pf'])}; margem de erro 95%: {brl(lo)} a {brl(hi)}).\n")
    if m["expect"] < 0:
        o.append(f"> ⚠️ **Expectativa NEGATIVA: o robô não tem vantagem** neste conjunto. " + ("A diferença é estatisticamente significativa." if m["sig_neg"] else "(Com a margem de erro acima, ainda não se distingue de zero, mas também não há nenhuma evidência de lucro.)") + "\n")
    else:
        o.append("> Expectativa positiva neste conjunto — mas veja a margem de erro e o veredito fora da amostra abaixo.\n")
    o.append("### Custos\n")
    o.append(table([["Resultado SEM nenhum custo (preços ideais)", brl(g["total"], 0), brl(g["expect"]) + "/op"], ["Corretagem + emolumentos" + (" (estimados: placeholder)" if any(r["fees_est"] for r in rs) else ""), brl(-fees, 0), brl(-fees / m["n"]) + "/op"],
                  ["Derrapagem (slippage) medida", brl(-slip, 0), brl(-slip / m["n"]) + "/op"], ["Resultado LÍQUIDO", brl(m["total"], 0), brl(m["expect"]) + "/op"]], ["", "total", "por operação"]) + "\n")
    costs = fees + slip
    if g["total"] >= 0 > m["total"]:
        o.append(f"**Os custos sozinhos explicam o prejuízo**: sem custo nenhum o robô estava em {brl(g['total'], 0)}; os custos ({brl(costs, 0)}) o empurraram para {brl(m['total'], 0)}.\n")
    elif m["total"] < 0:
        o.append(f"Os custos ({brl(costs, 0)}) agravam, mas **não explicam sozinhos**: sem custo nenhum o resultado já era {brl(g['total'], 0)} (as perdas vêm das próprias operações).\n")
    be = breakeven(rs)
    if be:
        o.append("### Acerto necessário para empatar (por ativo)\n")
        o.append(table([[b["root"], brl(b["risk"]), brl(b["cost"]), f"{b['c'] * 100:.0f}%", f"{b['p_be'] * 100:.1f}%", f"{b['p_rw'] * 100:.1f}%", fnum(b['e_rw'] * b['risk'])] for b in be],
                       ["ativo", "risco/op", "custo/op", "custo ÷ risco", "acerto p/ empatar (alvo 1,5×)", "acerto esperado num mercado sem vantagem", "expectativa nesse mercado (R$/op)"]) + "\n")
        o.append("Num mercado em que o preço anda ao acaso, um stop com alvo 1,5× acerta ~40% das vezes. Se o acerto necessário para empatar é maior que isso, **o robô perde dinheiro só por custo, mesmo sem erro nenhum**.\n")
    if deep:
        o.append(breakdown(rs, "Ativo", lambda r: r["root"]))
        o.append(breakdown(rs, "Horário (faixas de 30 min)", lambda r: r["slot"]))
        o.append(breakdown(rs, "Dia da semana", lambda r: r["dow"], [d for d in DOW if d in {r["dow"] for r in rs}]))
        o.append(breakdown(rs, "Regime de mercado", lambda r: r["regime_v"]))
        o.append(breakdown(rs, "Lado", lambda r: "compra" if r["side"] == "buy" else "venda"))
        o.append(breakdown(rs, "Estratégia", lambda r: r.get("strategy") or ("v2: stop técnico ATR" if r.get("atr_pts") else "base EMA9×EMA21, stop fixo")))
        o.append(breakdown(rs, "Motivo de saída", lambda r: r["exit"], flags=False))
        o.append("> 🔴 = prejuízo estatisticamente provado (≥30 ops e margem de erro toda abaixo de zero). Recortes com poucas operações (<30) são ruído: **não bloqueie nada com base neles**.\n")
        sug = suggest_blocks(rs)
        o.append("### Cortes justificados pelos dados\n")
        o.append("\n".join(f"- {s}" for s in sug) + "\n" if sug else "Nenhum recorte tem prejuízo PROVADO (≥30 operações e margem de erro abaixo de zero). Por isso **nenhum horário/ativo/regime/lado foi cortado por palpite**.\n")
        worst = sorted(rs, key=lambda r: r["net"])[:20]
        o.append("### As 20 piores operações\n")
        streak, prev = defaultdict(int), {}
        sk = lambda r: (r["day"], r.get("source"), r.get("seed"))
        for r in rs:                                         # perdas seguidas no dia antes de cada operação
            prev[id(r)] = streak[sk(r)]
            streak[sk(r)] = streak[sk(r)] + 1 if r["net"] < 0 else 0
        rows = []
        for i, r in enumerate(worst, 1):
            les = "; ".join(lessons(r, prev[id(r)]))
            rows.append([i, f"{r['day']} {r['open_dt'].strftime('%H:%M')}", f"{r['contract']} {'compra' if r['side'] == 'buy' else 'venda'} {r.get('volume')}×", brl(r["net"]), r["exit"], r["regime_v"],
                         (r.get("why") or "cruzamento de médias EMA9×EMA21 (sinal de base)"), les])
        o.append(table(rows, ["#", "quando", "o quê", "resultado", "saída", "regime", "o que o robô viu / por que entrou", "o que deveria ter feito"]) + "\n")
    o.append("### Integridade da execução (procura de bugs)\n")
    o.append("\n".join(f"- {'✅' if a == 'ok' else '🚨'} {b}" for a, b in integrity(raw, settings)) + "\n")
    v = verdict(rs)
    o.append("### Veredito\n")
    o.append(f"**{v['status']}** — {v['text']}\n\n" + table([["dentro da amostra (primeiros 70%)", v["in"]["n"], brl(v["in"]["expect"]), fnum(v["in"]["pf"])], ["FORA da amostra (últimos 30%)", v["out"]["n"], brl(v["out"]["expect"]), fnum(v["out"]["pf"])]], ["", "ops", "expectativa/op", "fator de lucro"]) + "\n")
    return "\n".join(o)


# ───────────────────────── fontes de dados ─────────────────────────
def load_supabase() -> tuple[list[dict], list[dict], dict]:
    import requests
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not (url and key):
        sys.exit("Defina SUPABASE_URL e SUPABASE_KEY (chave service_role) no ambiente.")
    h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(t, params):
        out, off = [], 0
        while True:
            r = requests.get(f"{url}/rest/v1/{t}", params={**params, "limit": 1000, "offset": off}, headers=h, timeout=30)
            r.raise_for_status()
            rows = r.json()
            out += rows
            if len(rows) < 1000:
                return out
            off += 1000
    trades = get("b3_trades", {"select": "*", "order": "opened_at.asc"})
    try:
        decs = get("b3_decisions", {"select": "*", "order": "ts.asc"})
    except Exception:
        decs = []
    st = requests.get(f"{url}/rest/v1/b3_settings", params={"id": "eq.1", "select": "*"}, headers=h, timeout=30).json()
    return trades, decs, (st[0] if st else {})


SIM_SETTINGS = {"enabled": True, "mode": "sim", "real_unlocked": False, "real_locked": True, "symbols": ["WIN", "WDO"], "profile": "conservador", "risk_per_trade_brl": 50,
                "max_contracts": 2, "daily_loss_brl": 150, "daily_target_brl": None, "max_trades_per_day": 6, "stop_points_win": 150, "stop_points_wdo": 5, "rr": 1.5,
                "open_from": "09:05", "open_until": "17:00", "flat_at": "17:30"}


def collect_sim(days: int, seed: int, rules: str, settings: dict | None = None, cache: str | None = None, tag: str = "") -> tuple[list[dict], list[dict], dict]:
    cf = Path(cache) / f"{tag or rules}_{seed}_{days}.json" if cache else None
    if cf and cf.exists():
        d = json.loads(cf.read_text())
        return d["trades"], d["decisions"], d["settings"]
    os.environ["HEXADESK_DEV"] = "1"
    from hexadesk_connector.config import Config
    from hexadesk_connector.sim import SimRunner
    from hexadesk_connector.store import MemoryStore
    s = dict(SIM_SETTINGS, **(settings or {}))
    st = MemoryStore(s)
    r = SimRunner(st, Config(), seed=seed, rules=rules)
    last, n = r.gw.t.date(), 0
    while n < days:
        r.tick()
        if r.gw.t.date() != last:
            n += 1
            last = r.gw.t.date()
    out = ([dict(t) for t in st.trades], st.decisions, s)
    if cf:
        cf.parent.mkdir(parents=True, exist_ok=True)
        cf.write_text(json.dumps({"trades": out[0], "decisions": out[1], "settings": out[2]}, default=str))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--supabase", action="store_true")
    ap.add_argument("--json")
    ap.add_argument("--sim", type=int, help="dias de simulador interno (preços artificiais)")
    ap.add_argument("--seeds", type=int, nargs="*", default=[1, 2, 3])
    ap.add_argument("--cache", help="pasta para guardar/reaproveitar as simulações")
    ap.add_argument("--variants", nargs="*", default=["legacy", "v2", "v2_risco100"])
    ap.add_argument("--out", default=str(ROOT / "DIAGNOSTICO.md"))
    ap.add_argument("--header", help="arquivo .md com texto a colocar no topo")
    a = ap.parse_args()
    parts = []
    if a.header:
        parts.append(Path(a.header).read_text(encoding="utf-8"))
    if a.supabase or a.json:
        if a.supabase:
            raw, decs, st = load_supabase()
        else:
            d = json.load(open(a.json, encoding="utf-8"))
            raw, decs, st = d["trades"], d.get("decisions", []), d.get("settings", {})
        groups = defaultdict(list)
        for t in raw:
            groups[(t.get("source") or "mt5", t.get("mode"))].append(t)
        names = {("internal", "sim"): "Simulador interno (preços ARTIFICIAIS)", ("mt5", "sim"): "Conta DEMO do MT5 (preços reais)", ("mt5", "real"): "Conta REAL (dinheiro de verdade)"}
        for k, g in sorted(groups.items()):
            parts.append(section(enrich(g, decs), g, names.get(k, str(k)), st))
    if a.sim:
        V = {"legacy": ("legacy", {}, "ANTES — regras antigas (stop fixo 150/5 pts, 09:05, sem parar após perdas)"),
             "v2": ("v2", {"open_from": "09:15", "daily_loss_brl": 100, "max_trades_per_day": 3, "max_contracts": 1}, "DEPOIS — regras v2 (stop técnico ATR, 09:15, para após 2 perdas, notícias), perfil Conservador R$ 50/op"),
             "v2_risco100": ("v2", {"open_from": "09:15", "daily_loss_brl": 200, "profile": "moderado", "risk_per_trade_brl": 100, "max_contracts": 2}, "DEPOIS — regras v2 com orçamento de risco maior (R$ 100/op, só para medir quantas operações surgem)")}
        for name in a.variants:
            rules, over, label = V[name]
            raw, decs, st = [], [], SIM_SETTINGS
            for sd_ in a.seeds:
                r_, d_, st = collect_sim(a.sim, sd_, rules, over, a.cache, name)
                for t in r_:
                    t["seed"] = sd_
                raw += r_
                decs += d_
            parts.append(section(enrich(raw, decs), raw, f"Simulador — {label} · {len(a.seeds)} sementes × {a.sim} pregões", st, deep=(name == "legacy")))
    Path(a.out).write_text("\n\n".join(parts), encoding="utf-8")
    print("escrito", a.out)


if __name__ == "__main__":
    main()
