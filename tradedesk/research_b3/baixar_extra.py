"""Baixa candles de 15 min de ativos que a pesquisa NUNCA usou (teste final em ativos inéditos). Fonte pública: data-api.binance.vision."""
import json, sys, time, urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "research" / "data"
START, END = 1699588800000, 1794200000000    # 2023-11-10 → 2026-11-09 (mesmo período dos arquivos originais)


def get(sym):
    rows, t = [], START
    while t < END:
        url = f"https://data-api.binance.vision/api/v3/klines?symbol={sym}&interval=15m&startTime={t}&limit=1000"
        for k in range(5):
            try:
                d = json.load(urllib.request.urlopen(url, timeout=30)); break
            except Exception:
                time.sleep(2 * (k + 1))
        else:
            raise SystemExit(f"falhou {sym} em {t}")
        if not d:
            break
        rows += [[int(r[0]), float(r[1]), float(r[2]), float(r[3]), float(r[4]), float(r[5])] for r in d]
        t = int(d[-1][0]) + 900_000
    return rows


for s in sys.argv[1:]:
    r = get(s); json.dump(r, open(OUT / f"{s}_15m.json", "w")); print(s, len(r))
