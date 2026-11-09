# Guia — Day trade na B3 (WIN/WDO) com a Clear + MetaTrader 5

> **Leia primeiro.** Este guia leva você de "não tenho nada" até o robô rodando na conta **DEMO** (dinheiro fictício).
> Nada aqui coloca dinheiro real em risco. O modo real só libera depois de: estratégia aprovada nos testes + 20 pregões no simulador + confirmação dupla.
>
> **O que eu NÃO consegui confirmar (pergunte à Clear antes de depender disso):**
> 1. o nome exato do servidor demo (`ClearInvestimentos-DEMO` foi o que você me informou; não achei documentação oficial);
> 2. se a Clear permite robôs/automação pelo MT5 na sua conta;
> 3. o horário da zeragem compulsória do day trade (por isso o robô zera às 17:30 e isso é configurável: deixe SEMPRE antes do horário da Clear);
> 4. margem exigida e corretagem atuais do WIN/WDO (mudam com frequência).
>
> A estratégia que acompanha o robô é só de **teste de encanamento** (cruzamento de médias, NÃO validada). Nenhuma estratégia foi aprovada ainda.

---

## 0) Ver o robô funcionando AGORA (sem conta, sem MT5, sem login)

Ao rodar o **`Instalar-Windows.bat`** (o instalador principal), o **Simulador interno** sobe sozinho junto com o site. Ele não precisa de nada seu: nem Clear, nem MT5, nem senha.

1. Abra `http://localhost:3001/b3` (ou a porta que o instalador mostrou). Você entra direto como dono.
2. Na **primeira vez** o robô é **ligado sozinho** (dinheiro fictício: **R$ 10.000**). Depois ele respeita o seu botão ligar/pausar.
3. Em poucos minutos você vê: entradas com stop e alvo, saídas, resultado do dia, log ao vivo, **PARAR TUDO**, e a **zeragem às 17:30**.

**O que é artificial (leia):** os preços são **inventados por computador** (um mercado "aleatório neutro", sem tendência embutida) e o relógio é **acelerado 30×** (um pregão inteiro em ~17 minutos). Lucro ou prejuízo aqui **não significa nada** sobre o mercado real, e esses dias **não contam** para liberar o modo real. O objetivo é só você **ver o funcionamento** do robô e do painel. A faixa azul avisa "PREÇOS ARTIFICIAIS".

Se o conector do MT5 (seção 4) estiver ligado, o simulador interno **fica em espera** sozinho para não disputar o painel.

Se a tela do painel der erro de "tabela não existe": rode o `Instalar-Windows.bat` de novo — ele aplica as tabelas novas no banco local.

## 1) Abrir conta na Clear

1. Entre no site da **Clear** (clear.com.br) ou no app e clique em **Abrir conta**.
2. Preencha CPF, dados pessoais e envie documento e selfie quando pedir. Aceite os contratos.
3. Espere a aprovação (o prazo varia). Você recebe e-mail/SMS.
4. Faça o **perfil de investidor** (suitability) e libere o **mercado de futuros / day trade**. Algumas corretoras pedem aceite de termos específicos para futuros; se não achar, peça ao atendimento da Clear.
5. Para operar de verdade (mais tarde) você vai precisar depositar **margem**. **Não deposite nada agora**: o simulador não precisa.

> Dica: ligue ou abra o chat da Clear e pergunte, de uma vez, os 4 itens da caixa acima. Anote as respostas.

## 2) Ativar o MetaTrader 5 (MT5) da Clear

1. Na área logada da Clear procure **Plataformas → MetaTrader 5** (o nome do menu pode variar) e **baixe o instalador do MT5 da Clear**. Instale (Avançar → Avançar → Concluir).
2. Na área da Clear você também ativa/solicita o acesso ao MT5 da **conta real** (login e senha próprios). Guarde — só será usado bem depois.
3. Abra o MT5. Vá em **Ferramentas → Opções → Expert Advisors** e marque **Permitir negociação algorítmica**. Na barra de cima, o botão **Algo Trading** (negociação algorítmica) deve ficar **verde**. Sem isso, o robô não consegue enviar ordens.

## 3) Criar a conta DEMO (servidor `ClearInvestimentos-DEMO`)

1. No MT5: menu **Arquivo → Abrir uma conta**.
2. Na lista de servidores, digite **Clear** (ou `ClearInvestimentos-DEMO`) e selecione o servidor demo. Clique **Avançar**.
3. Escolha **Conta demo**, preencha nome e e-mail e **Concluir**. O MT5 mostra **Login** e **Senha** da demo — **anote os dois** (você vai colar no conector).
4. Se o servidor demo **não aparecer** na lista, a Clear provavelmente entrega a demo por outro caminho: peça o login/senha da demo ao atendimento.
5. Contas demo podem **expirar** (comum: ~30 dias). Se expirar, o MT5 pede para criar outra no mesmo servidor.
6. Confira no **Observação do Mercado** (Ctrl+M): clique com o direito → **Símbolos** → procure `WIN` e `WDO` e adicione os contratos vigentes (ex.: `WINZ26`, `WDOZ26`). Veja se há cotação (no pregão, 09:00–18:00).

## 4) Rodar o conector no SEU PC Windows (enquanto não tem VPS)

Você precisa de: o **site rodando** (`Instalar-Windows.bat`, que já sobe o Supabase local) e o **MT5 instalado** com a conta demo criada.

1. Dê **duplo clique em `connector\Instalar-Conector-Windows.bat`**. Ele:
   - instala o **Python 3.12** se faltar (pelo `winget`) e as bibliotecas;
   - procura o MT5 instalado;
   - pergunta o **login e a senha da DEMO** e o servidor (já sugere `ClearInvestimentos-DEMO`). As senhas ficam **só neste PC, criptografadas** (nunca vão para o site);
   - **reaproveita sozinho** o endereço e a chave do Supabase local (do `.env` do site);
   - roda um **teste** (conecta no painel e no MT5, mostra os contratos vigentes, o valor do ponto e se a conta é DEMO);
   - pergunta se quer **iniciar sozinho quando você ligar o PC**.
2. Abra o painel: `http://localhost:3001/b3` (ou a porta que o instalador mostrou). Aparece a faixa **azul SIMULADOR**.
3. **Duplo clique em `connector\Iniciar-Conector.bat`** (deixe a janela aberta; ele reinicia sozinho se cair).
4. No painel, aparece o saldo da demo. Clique em **▶ ligar robô**. Ele só abre posições de **segunda a sexta (dia útil), 09:05–17:00**, e **zera tudo às 17:30**.
5. **PARAR TUDO** (botão vermelho) zera todas as posições na hora e desliga o robô.

**Importante:** o PC precisa estar **ligado, sem hibernar** e com internet durante o pregão. Se desligar, as posições abertas **continuam protegidas pelo stop que fica gravado no servidor da corretora**, mas o robô para de operar e você recebe um alerta por e-mail (precisa do Resend configurado). Em notebook, desative a suspensão automática (Painel de Controle → Energia).

**Controlar pelo celular:** hoje o painel só abre no PC onde está instalado. Para acessar de qualquer lugar é preciso publicar o site (Vercel) e usar o Supabase **na nuvem** (veja o README). Isso também é obrigatório se o conector rodar numa VPS.

## 5) VPS Windows (para o robô rodar o dia todo, sem seu PC)

**O que a VPS precisa ter:** Windows Server (com licença incluída), **2 vCPU e 4 GB de RAM no mínimo**, disco SSD, acesso por **Área de Trabalho Remota (RDP)**, e **localização em São Paulo**. Mais barato que isso costuma travar o MT5.

**Opções que encontrei (preços de sites de terceiros — podem estar desatualizados; confirme no site do provedor antes de pagar):**

| Provedor | Preço visto | Observações |
|---|---|---|
| **BH Servers** (bhservers.com.br) | a partir de ~R$ 99,95/mês (faixas até ~R$ 570) | VPS Windows/Linux em São Paulo; o plano mais barato provavelmente é pequeno demais — confira RAM/CPU |
| **QNAX Cloud Trader** (qnax.io) | ~R$ 201,75/mês (plano "Pro") em agregador | anuncia 1–3 ms até a B3, voltado a MT5/B3 |
| **Hypehost** (hypehost.com.br) | preço não apareceu na fonte | plano "Trader VPS" voltado a WIN/WDO |

**Minha recomendação:** comece pelo **QNAX Cloud Trader ou Hypehost** (feitos para MT5/B3) e **só contrate mês a mês**, sem plano anual. Antes de pagar, pergunte: "a licença do Windows está inclusa?", "tem teste/reembolso?", "qual a RAM do plano?". Depois de contratar, meça a latência na conta demo — para um robô de 5 minutos, 20–50 ms já bastam; milissegundos extras não mudam nada na estratégia atual. **Não consegui verificar a qualidade real de nenhum deles.**

### Instalar na VPS (passo a passo)

1. Contratada a VPS, o provedor manda **IP, usuário e senha**. No seu PC abra **Conexão de Área de Trabalho Remota** (digite no Windows), cole o IP, entre com usuário/senha. Você verá o Windows da VPS.
2. **Dentro da VPS**: instale o **MT5 da Clear** (passo 2) e entre na **conta demo** (passo 3).
3. Copie para a VPS a pasta **`connector`** (arraste pelo RDP ou baixe o ZIP do projeto na VPS).
4. **Supabase na nuvem:** a VPS não enxerga o Supabase do seu PC (`localhost`). Crie o projeto grátis em **supabase.com**, rode as migrations `001`, `002` e `003` (README → "Supabase"), e **publique o site** (Vercel) apontando para ele.
5. Na VPS, dê duplo clique em **`Instalar-Conector-Windows.bat`**. Quando pedir o endereço do painel e a chave `service_role`, **cole os do Supabase na nuvem** (Project Settings → API). Responda **S** para iniciar sozinho no login.
6. **Evite que a VPS peça senha ao reiniciar:** configure o logon automático do Windows (Executar → `netplwiz`) ou peça ao provedor. Assim, após um reinício, o MT5 e o conector sobem sozinhos.
7. **Feche a janela do RDP pelo X** (não "Sair do Windows"): a sessão continua rodando.
8. No painel (do celular ou PC): faixa azul **SIMULADOR**, saldo da demo e **conector ativo**.

## 6) Se der erro

| Mensagem | O que fazer |
|---|---|
| "MT5 initialize falhou" | Abra o MT5 uma vez à mão e faça login na demo; confira o caminho do `terminal64.exe` (rode `Instalar-Conector-Windows.bat` de novo) |
| "Conta REAL conectada, mas o modo é SIMULADOR" | Você colou o login da conta real no campo da demo. O robô **recusa** operar: rode o instalador e use o login da DEMO |
| "autotrading disabled" / ordens recusadas | Ative o botão **Algo Trading** (verde) e a opção "Permitir negociação algorítmica" |
| "Conector desligado ou sem sinal" | Abra o MT5 e o `Iniciar-Conector.bat`; confira internet e se o PC/VPS está acordado |
| Sem cotação do WIN/WDO | Fora do pregão ou contrato errado: adicione o contrato vigente no Observação do Mercado |
| Nome do servidor não encontrado | Peça à Clear o nome exato do servidor demo |

## 6b) Dinheiro REAL: como liberar (modo LIMITADO)

**Antes de tudo, o que você precisa ter feito:** conta na Clear aprovada, MT5 instalado, conector rodando na **conta DEMO** e **pelo menos 5 pregões válidos** nela (dia válido = robô ligado por 4 horas ou mais dentro do pregão; o simulador interno **não conta**). Você também precisa do dinheiro depositado na Clear (o app nunca toca nele).

Como **nenhuma estratégia foi aprovada**, o modo real só abre no **modo LIMITADO** (liberação do dono):
- no máximo **1 contrato**, **1 posição por vez**;
- perda máxima de **R$ 100 por dia** (bateu, zera e para até amanhã);
- no máximo **3 operações por dia**; perfil conservador e risco de até **R$ 50 por operação**;
- esses tetos valem **acima de qualquer configuração**, no painel **e** no conector.

**Passo a passo:**
1. Configure a conta **REAL** no conector: `python -m hexadesk_connector configurar` (a demo continua salva).
2. Dê a segunda trava na sua máquina: `python -m hexadesk_connector configurar --permitir-real` e digite `PERMITIR REAL`.
3. No painel `/b3`, clique em **Ativar modo REAL…**: marque as **3 confirmações**, digite **OPERAR REAL** e **EU ASSUMO O RISCO**, e clique em **liberar modo REAL LIMITADO**.
4. A faixa vira **vermelha** ("DINHEIRO REAL · MODO LIMITADO") e o robô fica **desligado**. Ligue na mão e acompanhe de perto.
5. **Voltar ao simulador** é um botão e zera as posições.

**Leia isto:** a estratégia do robô é só um **teste** (cruzamento de médias), nunca foi validada, e **não há garantia nenhuma de lucro**. O limite diário de R$ 100 reduz o prejuízo por dia, mas ainda é prejuízo real: em 20 dias ruins são R$ 2.000. O conector **nunca foi executado num MT5 real**: por isso o mínimo de 5 pregões na demo existe. Se o conector se comportar de forma estranha na demo (ordem duplicada, stop sem aparecer, posição que não zera), **não passe para o real**.

## 7) Segurança e limites (como o robô se protege)

- **Duas travas para o modo REAL**: uma no site (com estratégia aprovada: 20 pregões na demo do MT5 + confirmações + `OPERAR REAL`; sem estratégia aprovada: só o **modo LIMITADO** acima) e outra **na máquina do conector** (`allow_real`, só se você digitar `PERMITIR REAL` em `python -m hexadesk_connector configurar --permitir-real`).
- O robô **recusa operar** se o tipo da conta conectada (demo/real) não bate com o modo da faixa.
- **Stop em toda ordem, gravado no servidor da corretora**. Se a corretora não confirmar o stop, o robô **zera a posição na hora**.
- Limite de perda diária em R$ (bateu → zera e para até amanhã), meta diária opcional, máximo de operações/dia, 1 posição por ativo.
- Sem cotações chegando ou sem contato com o painel por mais de 1 minuto → **não abre novas posições**.
- Feriados: a lista é conservadora (inclui todos os feriados nacionais). Confira o calendário oficial da B3 todo início de ano; dá para travar dias extras na configuração do conector.

**Lembrete honesto:** day trade de mini índice/dólar é difícil e a maior parte das pessoas perde dinheiro. A estratégia do robô ainda não foi validada. Use o simulador por semanas e só pense em dinheiro real se os testes de estratégia (que ainda faltam) forem aprovados.
