"""Exporta candles de 5 min do MetaTrader 5 (da SUA corretora) para CSV, para rodar o protocolo de pesquisa nos seus dados da B3.
   python tools/exportar_historico.py WINZ26 WINV26 WDOX26 --de 2026-01-01 --ate 2026-11-09 --saida dados_b3
Depois:  python research_b3/evaluate.py csv dados_b3 select   e depois   ... test   (UMA vez)
OBS.: cada arquivo é um CONTRATO; para uma série contínua, use cada contrato só no período em que ele foi o vigente."""
import argparse
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hexadesk_connector.config import default_state_dir, Config  # noqa: E402
from hexadesk_connector.secure import load_secrets  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("simbolos", nargs="+"); ap.add_argument("--de", required=True); ap.add_argument("--ate", required=True); ap.add_argument("--saida", default="dados_b3")
    a = ap.parse_args()
    import MetaTrader5 as mt5  # só no Windows
    d = default_state_dir(); cfg, sec = Config.load(d), load_secrets(d)
    c = sec["demo"]
    if not mt5.initialize(login=int(c["login"]), password=c["password"], server=c["server"], **({"path": cfg.mt5_path} if cfg.mt5_path else {})):
        sys.exit(f"MT5: {mt5.last_error()}")
    out = Path(a.saida); out.mkdir(exist_ok=True)
    t0 = datetime.fromisoformat(a.de).replace(tzinfo=timezone.utc); t1 = datetime.fromisoformat(a.ate).replace(tzinfo=timezone.utc)
    for s in a.simbolos:
        mt5.symbol_select(s, True)
        rows = mt5.copy_rates_range(s, mt5.TIMEFRAME_M5, t0, t1)
        if rows is None or len(rows) == 0:
            print(s, "sem dados", mt5.last_error()); continue
        with open(out / f"{s}.csv", "w", newline="") as f:
            w = csv.writer(f); w.writerow(["time", "open", "high", "low", "close", "volume"])
            for r in rows:
                w.writerow([int(r["time"]), r["open"], r["high"], r["low"], r["close"], int(r["tick_volume"])])
        print(s, len(rows), "candles")
    mt5.shutdown()


if __name__ == "__main__":
    main()
