# Cripto na Foxbit (BTC/BRL, ETH/BRL, SOL/BRL) — resultado com dados e taxas reais

**Conclusão: a estratégia de cripto atual NÃO tem vantagem na Foxbit. Perde dinheiro em todos os ativos, com maker ou taker.**

- Dados: candles de 1 hora da própria Foxbit (API pública), **2024-11-10 a 2026-11-09 (2 anos, 17.519 candles por ativo)**.
- Estratégia: a nota técnica com os parâmetros padrão do app (stop 3%, alvo 6%, trailing 2%, 5% da conta por operação, nota mínima 0,7). **Nenhum parâmetro foi ajustado com estes dados**: os 2 anos inteiros funcionam como teste fora da amostra para esses valores fixos.
- Custos: taxa da Foxbit **0,50% por lado (taker)** ou **0,25% (maker)**, mais 0,05% de derrapagem por execução. (Tabela pública; pode cair com volume. Confirme a sua faixa.)
- Reproduzir: `npx tsx research/foxbit_bt.ts`.

| Ativo | Taxa | Operações | Acerto | Fator de lucro | Média por operação | Resultado em 2 anos | Perda máx. | Comprar e segurar |
|---|---|---|---|---|---|---|---|---|
| BTC/BRL | taker 0,5% | 205 | 40% | **0,37** | −1,45% | −13,8% | 13,9% | −17% |
| BTC/BRL | maker 0,25% | 205 | 43% | **0,52** | −0,95% | −9,3% | 9,6% | −17% |
| ETH/BRL | taker 0,5% | 344 | 44% | **0,44** | −1,20% | −18,7% | 18,7% | −37% |
| ETH/BRL | maker 0,25% | 344 | 46% | **0,63** | −0,71% | −11,5% | 11,5% | −37% |
| SOL/BRL | taker 0,5% | 436 | 43% | **0,41** | −1,28% | −24,4% | 24,5% | −61% |
| SOL/BRL | maker 0,25% | 436 | 46% | **0,59** | −0,79% | −15,8% | 15,8% | −61% |

(Média por operação = % da posição; resultado = % da conta com 5% por operação.)

## O que isso significa em reais (conta de R$ 10.000, somando os três ativos, aproximado)
- Com taxa taker: cerca de **−57% em 2 anos ≈ −R$ 240 por mês**. Com taxa maker: cerca de **−37% ≈ −R$ 150 por mês**.
- Nenhum ativo ficou perto de fator de lucro 1,0. A taxa de 0,5% por lado (1% de ida e volta) consome sozinha uma grande parte de qualquer alvo de 6%.
- O mercado caiu no período (comprar e segurar também perdeu), então parte do prejuízo é o mercado, mas o robô não protegeu: ele também perdeu.

## Consequência
- `STRATEGY_APPROVED` continua `false`: **clientes não podem operar com dinheiro real e a venda não abre**.
- Para aprovar cripto seria preciso uma estratégia nova que, no teste final **fora da amostra** e **com estas taxas**, tenha fator de lucro ≥ 1,3, perda máxima ≤ 15% e ≥ 300 operações. Taxas de 1% por ida e volta tornam isso difícil para estratégias de poucos dias de duração; operações mais longas e mais seletivas, ou execução maker, são os caminhos a pesquisar.
