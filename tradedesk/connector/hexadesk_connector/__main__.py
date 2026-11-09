"""Uso:  python -m hexadesk_connector [configurar | testar | rodar | simular | retreinar]"""
from __future__ import annotations

import argparse
import getpass
import os
import re
import sys
from pathlib import Path

from . import __version__
from .config import Config, default_state_dir
from .secrets_io import load_secrets, save_secrets  # noqa: F401  (re-export de secure)

DEFAULT_SERVER = "ClearInvestimentos-DEMO"


def ask(prompt: str, default: str = "", secret: bool = False) -> str:
    suffix = f" [{default}]" if default and not secret else ""
    v = (getpass.getpass if secret else input)(f"{prompt}{suffix}: ").strip()
    return v or default


def find_env() -> dict:
    """Procura o .env do painel (pasta acima) para reaproveitar URL e chave do Supabase local."""
    for base in [Path.cwd(), Path(__file__).resolve().parents[2], Path(__file__).resolve().parents[1]]:
        p = base / ".env"
        if p.exists():
            out = {}
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                m = re.match(r"^([A-Z_]+)=([^#\s]*)", line)
                if m:
                    out[m.group(1)] = m.group(2)
            return out
    return {}


def configurar(a) -> None:
    d = default_state_dir()
    cfg, sec = Config.load(d), load_secrets(d)
    env = find_env()
    print("\n=== Configuração do conector HEXADESK B3 ===\n(as senhas ficam SÓ neste computador, criptografadas)\n")
    url = os.environ.get("HEXADESK_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL") or cfg.supabase_url
    cfg.supabase_url = ask("Endereço do painel (Supabase URL)", url)
    key = os.environ.get("HEXADESK_SUPABASE_KEY") or env.get("SUPABASE_KEY") or sec.get("supabase_key", "")
    if key:
        print("Chave do painel (service_role): encontrada automaticamente." if not sec.get("supabase_key") else "Chave do painel: já salva.")
    else:
        key = ask("Chave service_role do Supabase", secret=True)
    sec["supabase_key"] = key
    print("\n--- Conta DEMO da Clear (modo SIMULADOR) ---")
    d0 = sec.get("demo", {})
    sec["demo"] = {"login": int(ask("Login (número da conta demo)", str(d0.get("login", "")))),
                   "password": ask("Senha da conta demo", secret=True) or d0.get("password", ""),
                   "server": ask("Servidor", d0.get("server", DEFAULT_SERVER))}
    print("\n--- Conta REAL (deixe em branco por enquanto; só use depois que o site liberar) ---")
    login = ask("Login real (Enter para pular)", str(sec.get("real", {}).get("login", "")))
    if login:
        sec["real"] = {"login": int(login), "password": ask("Senha real", secret=True), "server": ask("Servidor real", sec.get("real", {}).get("server", ""))}
    cfg.mt5_path = ask("Caminho do terminal64.exe (Enter = automático)", cfg.mt5_path or "") or None
    if a.permitir_real:
        if input('Para permitir operar em conta REAL nesta máquina digite "PERMITIR REAL": ').strip() == "PERMITIR REAL":
            cfg.allow_real = True
    cfg.save(d)
    save_secrets(d, sec)
    print(f"\nSalvo em {d}. Próximo passo: python -m hexadesk_connector testar")


def _load():
    d = default_state_dir()
    return d, Config.load(d), load_secrets(d)


def testar(a) -> None:
    from .contracts import current_contract
    from .gateway import Credentials, RealMt5Gateway
    from .store import SupabaseStore
    from datetime import datetime
    from .engine import SP
    d, cfg, sec = _load()
    ok = True
    print("1) Painel (Supabase)…")
    try:
        st = SupabaseStore(cfg.supabase_url, sec["supabase_key"])
        print("   OK, configurações:", "encontradas" if st.get_settings() else "AINDA NÃO CRIADAS (abra o painel B3 uma vez)")
    except Exception as e:
        ok = False; print("   FALHOU:", e)
    print("2) MetaTrader 5 (conta DEMO)…")
    gw = RealMt5Gateway(cfg.mt5_path)
    try:
        c = sec["demo"]
        gw.connect(Credentials(int(c["login"]), c["password"], c["server"]))
        acc = gw.account()
        print(f"   conectado: conta {acc.login} em {acc.server} · tipo {acc.mode.upper()} · saldo R$ {acc.balance:,.2f}")
        if acc.mode != "demo":
            ok = False; print("   ATENÇÃO: esta NÃO é uma conta DEMO! O simulador recusará operar.")
        today = datetime.now(SP).date()
        for root in ("WIN", "WDO"):
            av = gw.symbols(root + "*")
            cur = current_contract(root, today, (), cfg.roll_days[root], av or None)
            gw.select(cur)
            sp, t = gw.spec(cur), gw.tick(cur)
            print(f"   {root}: contrato vigente {cur} · R$ {sp.brl_per_point:.2f}/ponto · cotação {t.bid if t else 'sem cotação (mercado fechado?)'}")
            print(f"        candles M5 disponíveis: {len(gw.candles(cur, 'M5', 50))}")
    except Exception as e:
        ok = False; print("   FALHOU:", e)
    finally:
        gw.shutdown()
    print("\n" + ("TUDO CERTO. Pode rodar: python -m hexadesk_connector rodar" if ok else "Há problemas acima. Veja o guia (seção 'Se der erro')."))
    sys.exit(0 if ok else 1)


def rodar(a) -> None:
    from .engine import Engine
    from .gateway import RealMt5Gateway
    from .live import AsyncSink, LiveCollector, SupabaseLiveSink, TickRecorder
    from .runner import Runner
    from .store import SupabaseStore
    d, cfg, sec = _load()
    if not sec.get("demo") or not sec.get("supabase_key"):
        sys.exit("Rode primeiro: python -m hexadesk_connector configurar")
    store = SupabaseStore(cfg.supabase_url, sec["supabase_key"])
    gw = RealMt5Gateway(cfg.mt5_path)
    eng = Engine(gw, store, cfg, sec)

    def symbols() -> list[str]:
        roots = (eng.settings or {}).get("symbols") or ["WIN", "WDO"]
        try:
            return [eng._contract(r, eng.now().date()) for r in roots] if eng.connected_mode else []
        except Exception:
            return []

    rec = TickRecorder(d / "data" / "ticks")   # histórico próprio (ticks + book) para pesquisa
    sink = AsyncSink(SupabaseLiveSink(cfg.supabase_url, sec["supabase_key"]))
    from .shadow import ShadowManager
    live = LiveCollector(gw, symbols, sink, rec)
    eng.live = live                                    # fluxo/book para a camada de confirmação
    eng.shadow = ShadowManager(store, "mt5")           # campeão e desafiantes rodam em paralelo, sem dinheiro
    runner = Runner(eng, live, rec)
    print(f"HEXADESK B3 conector v{__version__} rodando (ao vivo + gravando ticks em {d / 'data' / 'ticks'}). Ctrl+C para parar (posições já têm stop na corretora).")
    try:
        runner.run_forever()
    except KeyboardInterrupt:
        pass
    finally:
        sink.close()
        try:
            store.upsert_status({"state": "stopped"})
            store.log("warn", "logger", "Conector parado.")
        except Exception:
            pass
        gw.shutdown()


def retreinar(a) -> None:
    """Retreino semanal: registra um DESAFIANTE (nunca troca o campeão). Precisa de pip install -r requirements-ml.txt."""
    from .retrain import retrain
    from .store import SupabaseStore
    d, cfg, sec = _load()
    store = SupabaseStore(cfg.supabase_url, sec["supabase_key"])
    st = store.get_settings() or {}
    champ = store.get_champion() or {}
    r = retrain(d / "data" / "ticks", d / "models", store, st, champ.get("config"))
    print(r["status"], {k: v for k, v in r.items() if k != "status"})
    store.log("info", "analyst", f"Retreino semanal: {r['status']}")


def autopsia(a) -> None:
    """Autópsia dos SEUS trades (simulador + demo + real): grava DIAGNOSTICO-SEUS-DADOS.md. Só lê o banco; não altera nada."""
    _, cfg, sec = _load()
    os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"] = cfg.supabase_url, sec.get("supabase_key", "")
    root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(root))
    from research_b3 import autopsia as A
    out = Path.cwd() / "DIAGNOSTICO-SEUS-DADOS.md"
    sys.argv = ["autopsia", "--supabase", "--out", str(out)]
    A.main()
    print(f"\nPronto: abra {out}")


def simular(a) -> None:
    """Simulador interno: mercado artificial, dinheiro fictício, sem MT5. Lê SUPABASE_URL/SUPABASE_KEY do ambiente (Docker) ou da configuração local."""
    from .sim import SimRunner
    from .store import SupabaseStore
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not (url and key):
        _, cfg, sec = _load()
        url, key = cfg.supabase_url, sec.get("supabase_key")
    if not (url and key):
        sys.exit("Faltam SUPABASE_URL e SUPABASE_KEY (no Docker vêm do .env; no PC rode: configurar).")
    from .live import AsyncSink, SupabaseLiveSink
    SimRunner(SupabaseStore(url, key), Config(), balance=a.saldo, speed=a.velocidade, seed=a.seed, trending=a.tendencias, sink=AsyncSink(SupabaseLiveSink(url, key))).run_forever()


def main() -> None:
    p = argparse.ArgumentParser(prog="hexadesk_connector")
    sub = p.add_subparsers(dest="cmd")
    c = sub.add_parser("configurar"); c.add_argument("--permitir-real", action="store_true")
    sub.add_parser("testar"); sub.add_parser("rodar"); sub.add_parser("retreinar"); sub.add_parser("autopsia")
    m = sub.add_parser("simular", help="simulador interno (mercado artificial, dinheiro fictício, sem MT5)")
    m.add_argument("--saldo", type=float, default=10_000.0); m.add_argument("--velocidade", type=float, default=30.0)
    m.add_argument("--seed", type=int, default=None); m.add_argument("--tendencias", action="store_true", help="embute tendências no mercado artificial (infla o resultado; só para testar o motor)")
    a = p.parse_args()
    {"configurar": configurar, "testar": testar, "rodar": rodar, "simular": simular, "retreinar": retreinar, "autopsia": autopsia}.get(a.cmd, lambda _: p.print_help())(a)


if __name__ == "__main__":
    main()
