"""Gera research/RESEARCH_B3.md a partir de results/<nome>/select.json e test.json."""
import json, sys
from pathlib import Path
R = Path(__file__).resolve().parent / "results"
name = sys.argv[1] if len(sys.argv) > 1 else "proxy_cripto"
sel = json.load(open(R / name / "select.json")); tst = json.load(open(R / name / "test.json"))
f = lambda m: f"{m['trades']} | {m['pf']:.2f} | {m['dd']:.3f} | {m['sharpe']:.2f} | {m['win']*100:.0f}%"
L = ["# Pesquisa das camadas de inteligência — relatório", "",
     f"Conjunto de dados: **{name}**. " + ("**ATENÇÃO: é um PROXY de cripto (BTC/ETH/SOL, 15m, 3 anos), NÃO são dados da B3.** Serve para validar a máquina de avaliação; as conclusões NÃO se transferem para WIN/WDO." if name.startswith("proxy") else "Dados fornecidos pelo usuário."), "",
     "Protocolo: 60% treino · 20% validação · 20% teste final (uma única vez, com trava). Sinal de base = cruzamento EMA9×EMA21 com stop 0,4% e alvo 1,5×; sessões 12:05–20:00 UTC, zeragem 20:30 UTC. "
     "Custos escalados para a proporção custo/stop da B3 (≈ 8% do stop). Aceite: superar a versão atual em fator de lucro, drawdown e Sharpe, com PF > 1 e ≥ 100 operações. "
     "**Regra de consistência (acrescentada depois desta rodada):** a camada não pode ter PF pior que a base em treino nem em validação.", "",
     "| Versão | Trecho | Operações | PF | Drawdown | Sharpe | Acerto |", "|---|---|---|---|---|---|---|"]
for seg in ("train", "val"):
    L.append(f"| base (sem camadas) | {seg} | {f(sel['baseline'][seg])} |")
for k, v in sel["layers"].items():
    for seg, m in v.items():
        L.append(f"| {k} | {seg} | {f(m)} |")
L.append(f"| base (sem camadas) | **TESTE** | {f(tst['baseline'])} |")
for k, v in tst["layers"].items():
    L.append(f"| {k} | **TESTE** | {f(v['metrics'])} |")
L += ["", "## Veredito por camada", "", "| Camada | Regra formal (só o teste) | Consistente em treino e validação? | Decisão |", "|---|---|---|---|"]
for k, v in tst["layers"].items():
    formal = v.get("passed_test_only", v["accepted"])
    if k in sel["layers"] and "train" in sel["layers"][k]:
        cons = all(sel["layers"][k][s]["pf"] >= sel["baseline"][s]["pf"] for s in ("train", "val"))
    else:
        cons = None
    dec = "**NÃO adotar**" if not (formal and (cons is not False)) else "adotar"
    L.append(f"| {k} | {'passou' if formal else 'reprovou'} | {'sim' if cons else 'não' if cons is False else 'n/a (modelo sem série de treino/validação comparável)'} | {dec} |")
L += ["", "Fluxo de ordens: " + tst["flow"] + ".", "",
      "## Leitura honesta", "",
      "- A versão de base **perde dinheiro** neste proxy (PF < 1 em todos os trechos). Melhorar um resultado negativo operando menos não é lucro.",
      "- Uma camada pode passar na regra formal por **sorte** num único trecho (poucas operações). Por isso a regra de consistência: se ela foi pior no treino e na validação, o teste favorável não é confiável.",
      "- **Nada aqui prova que as camadas ajudam na B3.** Rode o mesmo protocolo nos SEUS dados: `python research_b3/evaluate.py csv PASTA select` e depois `test` (uma vez).",
      "- Por isso todas as camadas continuam **DESLIGADAS** na versão campeã inicial."]
Path(__file__).resolve().parents[1].joinpath("research", "RESEARCH_B3.md").write_text("\n".join(L) + "\n")
print("research/RESEARCH_B3.md gerado")
