# Billing — Documento de Requisitos (v2, backend PocketBase)

> **Para o agente desenvolvedor.** Este documento é a especificação completa (`SPEC`) da aplicação Billing. A aplicação será **reconstruída do zero** com **PocketBase** como backend (já instalado no servidor do Robert). Leia tudo antes de começar. Onde o documento diz **DEVE**, é obrigatório; **DEVERIA** é fortemente recomendado; **PODE** é opcional.
>
> Versão 2 · 19/10/2026 · substitui `docs/SPEC.md` e `docs/PLANO.md` do repositório `robertruas/Billing` (que descreviam um servidor Node/Fastify próprio, agora abandonado).

---

## Índice

1. [Visão geral e objetivo](#1-visão-geral-e-objetivo)
2. [Perfil do utilizador](#2-perfil-do-utilizador)
3. [Glossário e conceitos](#3-glossário-e-conceitos)
4. [Requisitos funcionais](#4-requisitos-funcionais)
5. [Requisitos não funcionais](#5-requisitos-não-funcionais)
6. [Regra UX obrigatória: impedir zoom](#6-regra-ux-obrigatória-impedir-zoom)
7. [Stack técnica](#7-stack-técnica)
8. [Modelo de dados no PocketBase](#8-modelo-de-dados-no-pocketbase)
9. [Lógica no servidor (pb_hooks) e rotas próprias](#9-lógica-no-servidor-pb_hooks-e-rotas-próprias)
10. [Offline e sincronização](#10-offline-e-sincronização)
11. [Segurança](#11-segurança)
12. [Fluxos principais passo a passo](#12-fluxos-principais-passo-a-passo)
13. [Ecrãs e navegação](#13-ecrãs-e-navegação)
14. [Design](#14-design)
15. [Infraestrutura e deploy](#15-infraestrutura-e-deploy)
16. [Estrutura do repositório](#16-estrutura-do-repositório)
17. [Testes](#17-testes)
18. [Critérios de aceitação](#18-critérios-de-aceitação)
19. [Entregáveis](#19-entregáveis)
20. [Fora de âmbito / Fase 2](#20-fora-de-âmbito--fase-2)
21. [Lições da versão anterior](#21-lições-da-versão-anterior)

---

## 1. Visão geral e objetivo

O Billing é uma **PWA para telemóvel** (aparência de app nativa de iPhone) que permite a um trabalhador independente ter **controlo total das faturas que emite** para a empresa onde trabalha:

- regista as **timesheets semanais** (horas trabalhadas);
- emite, normalmente no fim de cada período, **uma fatura de horas** e **uma fatura de despesas / per diem** (alimentação, etc.);
- anexa a cada registo **o ficheiro exato da fatura emitida** (PDF);
- acompanha o estado: **rascunho → enviada → receção confirmada pela empresa → recebida (paga)**;
- quando o dinheiro cai na conta, marca a fatura como **recebida/finalizada** e **confere o valor** (igual ou diferente do emitido);
- consulta a qualquer momento, **inclusive offline**, as faturas e uma **visão geral de quanto recebeu em qualquer período**.

A app é **auto-hospedada** no servidor do Robert, com domínio próprio, e usa o **PocketBase já instalado** como backend (autenticação, base de dados, ficheiros, e-mail, API).

### Objetivos de qualidade
| Objetivo | Medida |
|---|---|
| Parecer app nativa iOS | Instalável, ecrã inteiro, sem barra do browser, transições de pilha, gestos, sem zoom, sem seleção acidental de texto |
| Funcionar offline | Toda a consulta e criação/edição funciona sem rede; sincroniza ao voltar a ligação |
| Fiável com dinheiro | Valores em cêntimos inteiros, totais recalculados no servidor, nenhuma perda de dados na sincronização |
| Seguro | Dados financeiros isolados por utilizador, backups cifrados, superfície de ataque mínima |

---

## 2. Perfil do utilizador

- **Quem:** profissional independente ("quase freelancer"), técnico, trabalha para uma empresa cliente principal (pode haver outras no futuro), em projetos com local, função e datas.
- **Ritmo:** timesheet **semanal**; faturação **por período** (geralmente mensal, mas **o período é livre**, ex.: 28/09 a 25/10).
- **Faturas:** duas por período, em regra: **Horas** (horas × taxa) e **Despesas / Per diem** (dias × per diem, refeições, deslocações, etc.).
- **Moeda principal:** EUR (suportar outras).
- **Dispositivo:** iPhone (prioridade), Android secundário. Uso com uma mão, em mobilidade, por vezes sem rede.
- **Idiomas:** português do Brasil e inglês.
- **Contas:** na prática um único utilizador (o Robert), mas o sistema DEVE ser multiutilizador seguro (isolamento total por conta) e permitir fechar o registo público.

---

## 3. Glossário e conceitos

| Termo | Significado |
|---|---|
| **Timesheet** | Relatório semanal de horas de um projeto (horas por dia). |
| **Período de faturação** | Intervalo `period_start`–`period_end` que a fatura cobre. **Início e fim livres**, podem cruzar meses e anos. |
| **Fatura de horas** (`hours`) | Linhas de horas × taxa horária, tipicamente uma linha por semana do período. |
| **Fatura de despesas** (`expenses`) | Per diem (dias × valor diário) e outras despesas (refeição, alojamento, deslocação, km, outro). |
| **Receção confirmada** | A empresa confirmou que recebeu a fatura (não significa pago). |
| **Recebida / Conferida** | O pagamento entrou na conta; o utilizador regista **data** e **valor recebido**; a app calcula a **diferença** face ao emitido. |
| **Snapshot** | Cópia dos dados do técnico, banco, cliente e projeto gravada **dentro da fatura** no momento da emissão, para que alterações futuras no perfil não alterem faturas antigas. |
| **Cêntimos** | Todos os valores monetários são inteiros em cêntimos (`1234,56 €` → `123456`). |

---

## 4. Requisitos funcionais

### 4.1 Autenticação e conta (PocketBase auth collection `mm_users`)

| ID | Requisito |
|---|---|
| AUTH-01 | **Registo** com apenas: nome, e-mail, senha (+ confirmação), idioma (pré-selecionado pelo dispositivo). Indicador de força da senha. Mínimo **10 caracteres**. |
| AUTH-02 | **Verificação de e-mail** obrigatória antes do primeiro login (`authRule: verified = true`). E-mail com link que abre a app (`/verificar-email?token=…`), que chama `confirmVerification`. Botão "Reenviar e-mail". |
| AUTH-03 | **Login** com e-mail + senha (`authWithPassword`). Mensagem genérica em erro ("E-mail ou senha incorretos"), sem revelar se a conta existe. Opção "Mostrar senha". |
| AUTH-04 | **Recuperação de senha**: pedido por e-mail (`requestPasswordReset`), resposta sempre igual ("Se existir uma conta…"); link abre `/redefinir-senha?token=…` na app, que chama `confirmPasswordReset`. Token de uso único, validade 30 min. Ao redefinir, todas as sessões anteriores ficam inválidas. |
| AUTH-05 | **Alterar senha** em Ajustes (pede senha atual). Invalida tokens dos outros dispositivos. |
| AUTH-06 | **Alterar e-mail** com confirmação no novo endereço (`requestEmailChange` / `confirmEmailChange`). |
| AUTH-07 | **Terminar sessão** neste dispositivo (limpa token e **todos os dados locais**; se houver alterações por sincronizar, avisar e pedir confirmação). |
| AUTH-08 | **Terminar sessão em todos os dispositivos** (rota própria que regenera o `tokenKey` do utilizador). |
| AUTH-09 | **Apagar conta**: pede a senha; apaga utilizador, todos os registos e ficheiros (cascade). Irreversível, com dupla confirmação. |
| AUTH-10 | **Fechar registo**: depois de criada a conta do Robert, o registo público é desligado (createRule de `mm_users` = `null`). Documentar no README como abrir/fechar. |
| AUTH-11 | A sessão mantém-se entre aberturas da app (token renovado com `authRefresh` ao abrir quando online). Abrir a app **offline** com sessão anterior entra direto com os dados locais. |
| AUTH-12 | Todos os e-mails de conta (verificação, recuperação, mudança de e-mail) no **idioma do utilizador** (pt-BR ou en) e com o nome/visual da app. |

### 4.2 Perfil e dados de faturação (pré-preenchimento)

O utilizador guarda uma vez os dados que se repetem; **cada nova fatura é pré-preenchida** com eles, e os campos continuam editáveis na fatura.

| Grupo | Campos (rótulo na fatura) |
|---|---|
| **Técnico** | Technician Name, Company Name, Email, Address, VAT, Tel |
| **Banco** | IBAN Name, IBAN, SWIFT / BIC, Currency |
| **Cliente** (empresa para quem trabalha) | Nome da empresa, Morada, VAT, E-mail de faturação |
| **Projeto** | Name, Role, Start Date, End Date, Location, taxa horária, per diem diário |
| **Faturação** | Moeda padrão, taxa horária padrão, per diem padrão, padrão de numeração (`{YYYY}-{SEQ}`, `{YY}`), próximo número, dias para lembrete de pagamento, início da semana (segunda/domingo) |

Regras:
- PERF-01 Validação de IBAN (checksum mod-97) e SWIFT/BIC (8 ou 11 caracteres); IBAN guardado normalizado (maiúsculas, sem espaços) e mostrado agrupado de 4 em 4.
- PERF-02 Vários clientes e projetos podem existir; um cliente e um projeto são marcados como **predefinidos**. Projetos podem ser arquivados.
- PERF-03 Ao criar fatura, o número é sugerido a partir do padrão e do próximo número; ao gravar, o próximo número incrementa.
- PERF-04 Campos vazios no perfil ficam vazios na fatura (nada inventado).

### 4.3 Timesheets semanais

| ID | Requisito |
|---|---|
| TS-01 | Criar timesheet por **projeto + semana** (semana segundo `week_starts_on`). Uma por projeto/semana. |
| TS-02 | Registar horas por dia (0–24, até 2 casas decimais, ex.: 7,5) e nota opcional por dia. Total semanal calculado. |
| TS-03 | Estados: `draft` (rascunho) → `submitted` (enviada à empresa) → `approved` (aprovada, opcional). |
| TS-04 | Anexar opcionalmente o PDF/imagem da timesheet enviada. |
| TS-05 | Lista de timesheets por mês com total de horas e indicação de **já faturada** (ligada a uma fatura) ou **por faturar**. |
| TS-06 | Uma semana pode ficar **dividida entre dois períodos de faturação** (ex.: período termina a uma quarta). Ao gerar a fatura, só entram os **dias dentro do período**; a timesheet fica "parcialmente faturada" até o resto entrar noutra fatura. Por isso a ligação à fatura é feita **ao nível do dia** (`mm_timesheet_entries.invoice`). |

### 4.4 Per diem e despesas

| ID | Requisito |
|---|---|
| PD-01 | Registar entradas por data: tipo (`perdiem`, `meal`, `lodging`, `travel`, `mileage`, `other`), descrição, quantidade, valor unitário, valor total (calculado), recibo opcional (PDF/imagem). |
| PD-02 | Atalho "Per diem do período": cria uma entrada `perdiem` por dia trabalhado do período (dias com horas nas timesheets, ou dias úteis se não houver timesheets), com o per diem do projeto. Editável antes de gravar. |
| PD-03 | Entradas ficam "por faturar" até serem incluídas numa fatura de despesas. |

### 4.5 Faturas

**Campos de uma fatura** (os da fatura real do Robert):

```
Technician Name · Company Name · Email · Address · VAT · Tel
IBAN Name · IBAN · SWIFT / BIC · Currency
Invoice Number · Invoice Date · Billing Period (início – fim)
Project Details: Name · Role · Start Date · End Date · Location
Work & Cost Breakdown: Description · Quantity · Rate (€) · Amount (€)
```
Mais: tipo (horas/despesas), cliente, estado, datas de envio/confirmação/recebimento, valor recebido, diferença, notas, anexos.

| ID | Requisito |
|---|---|
| INV-01 | Criar fatura **de horas** ou **de despesas**. Pré-preenchida com perfil + cliente/projeto predefinidos (snapshot). |
| INV-02 | **Período livre**: escolher início e fim em qualquer dia (validar fim ≥ início). Sugestão: dia seguinte ao fim do último período faturado do mesmo tipo/projeto → hoje. |
| INV-03 | **Gerar linhas a partir das timesheets** do período (horas): uma linha por semana recortada ao período, ex.: "Semana 40 · 28 set – 4 out · 40 h × 45,00 €". Liga as entradas de timesheet à fatura. |
| INV-04 | **Gerar linhas a partir do per diem/despesas** do período (despesas): agrupadas por tipo, ex.: "Per diem · 20 dias × 35,00 €". Liga as entradas à fatura. |
| INV-05 | Linhas editáveis manualmente: descrição, quantidade (até 2 decimais), unidade (`h`, `day`, `unit`, `km`), taxa (cêntimos), valor = `round(qtd × taxa)`; reordenar, apagar. Mín. 1, máx. 100 linhas. |
| INV-06 | Total = soma das linhas. **Recalculado e validado no servidor** (hook); o cliente nunca é a fonte de verdade do total. |
| INV-07 | **Anexar o PDF exato da fatura** emitida (e outros anexos: comprovativo de pagamento, e-mail de confirmação, recibos). PDF, JPEG, PNG; máx. 10 MB por ficheiro. Visualizar no ecrã (viewer nativo / nova folha), partilhar/descarregar, remover. Funciona offline (ficheiro guardado localmente e enviado ao sincronizar). |
| INV-08 | **Máquina de estados** (avançar e, com confirmação, recuar um passo): <br>`draft` → `sent` (data de envio) → `confirmed` (data da confirmação de receção pela empresa) → `paid` (data de recebimento + valor recebido). <br>`cancelled` (anulada) a partir de qualquer estado exceto `paid`. Saltar `confirmed` é permitido (`sent` → `paid`). |
| INV-09 | **Marcar como recebida (conferência)**: folha com valor recebido (pré-preenchido com o total), data (hoje), nota. Mostra em tempo real a **diferença** (recebido − emitido) a verde (=0), laranja (<0) ou azul (>0). Se diferente, a nota é recomendada. |
| INV-10 | **Histórico** de estados da fatura (linha do tempo: criada, enviada, confirmada, recebida, com datas e notas). |
| INV-11 | Editar, **duplicar** (para o período seguinte: copia linhas e dados, novo número, datas avançadas), apagar (soft delete, confirma; libera timesheets/despesas ligadas). |
| INV-12 | Número de fatura **único por utilizador** entre faturas não apagadas. Conflito detetado offline é mostrado ao sincronizar com pedido para alterar o número. |
| INV-13 | Fatura em `paid` fica **bloqueada** para edição de linhas/valores (só notas e anexos); desbloquear requer recuar o estado com confirmação. |
| INV-14 | **Alertas**: em atraso (enviada/confirmada há mais de N dias, N = lembrete de pagamento); recebida com diferença ≠ 0. |

### 4.6 Listas e consulta

| ID | Requisito |
|---|---|
| LST-01 | Lista de faturas com filtros rápidos (segmented control): **Todas · Pendentes** (sent+confirmed) **· Recebidas · Rascunhos**; filtro extra por tipo e por cliente/projeto. |
| LST-02 | Pesquisa por número, cliente, projeto, descrição, valor. |
| LST-03 | Agrupamento por **mês da data da fatura** (nunca pelo mês do período), com total por grupo. |
| LST-04 | Cada linha: tipo (ícone), número, período formatado, valor, estado (pill colorido), alerta. Swipe-actions estilo iOS: marcar recebida, apagar. |
| LST-05 | Tudo funciona offline sobre os dados locais. |

### 4.7 Resumo (ecrã inicial)

- Estado de sincronização e **data/hora da última sincronização** (sempre visível).
- Recebido no ano corrente; **A receber** (soma de pendentes, nº de faturas).
- Último período: horas faturadas e per diem.
- Alertas (atraso, diferenças, timesheets por faturar).
- Pendentes (lista curta) e recebidas recentemente.
- Botão "+" para nova fatura / timesheet / despesa (action sheet).
- Estado vazio com chamada para criar a primeira fatura.

### 4.8 Relatórios por período

| ID | Requisito |
|---|---|
| REP-01 | Seleção de intervalo: **Mês, Trimestre, Ano, Personalizado** (duas datas quaisquer) com navegação ‹ › entre intervalos. |
| REP-02 | **Base de datas** selecionável: **Data da fatura**, **Data de recebimento** (o que entrou na conta), ou **Período trabalhado** (faturas cujo período se sobrepõe ao intervalo, rateadas por dias de sobreposição quando o período cruza o limite). |
| REP-03 | Totais: emitido, recebido, a receber, diferenças acumuladas, horas faturadas, per diem/despesas; separado por tipo (horas / despesas). |
| REP-04 | Gráfico de barras por mês (emitido vs recebido) e lista mês a mês. |
| REP-05 | Filtro por cliente/projeto. |
| REP-06 | Exportar o relatório em **CSV** (separador `;`, datas ISO, valores com 2 decimais) — funciona offline. |
| REP-07 | Períodos que cruzam meses são tratados corretamente (ver §4.9). |

### 4.9 Regras de datas e períodos livres (críticas)

- Datas de calendário guardadas como `YYYY-MM-DD` (sem hora, sem fuso). Instantes (sincronização, eventos) em UTC ISO 8601.
- **Nunca assumir** que um período começa no dia 1 ou termina no último dia do mês.
- Formatação do período (pt-BR / en):

| Caso | Exemplo pt-BR | Exemplo en |
|---|---|---|
| Mesmo dia | 5 out 2026 | 5 Oct 2026 |
| Mesmo mês | 1–30 set 2026 | 1–30 Sep 2026 |
| Meses diferentes | 28 set – 25 out 2026 | 28 Sep – 25 Oct 2026 |
| Anos diferentes | 29 dez 2025 – 4 jan 2026 | 29 Dec 2025 – 4 Jan 2026 |

- Título curto: um mês se o período estiver contido nele ("Setembro 2026"), senão "set – out 2026".
- Divisão em semanas: semanas recortadas ao período, com contagem de dias úteis.
- Aritmética de datas sempre em UTC para evitar erros de horário de verão.
- Testes unitários obrigatórios para todas estas funções (ver §17).

### 4.10 Backup por e-mail com destino verificado (sistema próprio)

| ID | Requisito |
|---|---|
| BK-01 | Lista de **destinos de backup** (máx. 5). Adicionar um e-mail cria-o como `pending` e envia **para esse endereço** um e-mail com link de confirmação. |
| BK-02 | O link abre `/confirmar-backup?token=…` (página pública da app) que confirma o destino → `verified`. Token aleatório de 32 bytes, guardado só como **hash SHA-256**, uso único, validade **48 h**. Reenviar gera novo token e invalida o anterior. |
| BK-03 | **Só destinos `verified` recebem backups.** O servidor recusa qualquer envio para destino não verificado ou de outro utilizador. |
| BK-04 | **Enviar backup agora**: escolher destinos verificados, introduzir **frase-passe** (mín. 8 caracteres). O backup é gerado e **cifrado no dispositivo** (AES-256-GCM, chave derivada por PBKDF2-SHA-256 com 600 000 iterações e salt aleatório) e enviado ao servidor já cifrado; o servidor só o anexa ao e-mail. **O servidor nunca vê a frase-passe nem o conteúdo em claro.** |
| BK-05 | Opção **incluir anexos** (PDFs). Se o ficheiro final exceder 15 MB, avisar e sugerir enviar sem anexos ou exportar para ficheiro. |
| BK-06 | **Agendamento** (desligado / semanal / mensal): ao ativar, o utilizador introduz a frase-passe uma vez; a app deriva a chave e guarda-a como `CryptoKey` **não extraível** no IndexedDB deste dispositivo (junto com o salt). Quando o backup está vencido e a app é aberta com ligação, gera e envia automaticamente. Mostra próximo e último envio. Terminar sessão apaga a chave. |
| BK-07 | **Exportar para ficheiro** `.mmbk` (download local, cifrado com frase-passe; sem rede). |
| BK-08 | **Restaurar** de ficheiro `.mmbk`: pede frase-passe, decifra no dispositivo, valida o schema, mostra resumo (n.º de faturas, anexos, intervalo de datas) e **junta** aos dados atuais (upsert por id, nunca apaga). |
| BK-09 | **Histórico** de backups (data, tipo e-mail/exportação/restauro, destinos, tamanho, OK/erro). |
| BK-10 | O e-mail de backup contém: assunto "Billing · Backup DD/MM/AAAA", texto curto com instruções de restauro (pt-BR/en), anexo `Billing-backup-AAAA-MM-DD.mmbk`. Nunca dados financeiros em claro no corpo. |

Formato do ficheiro `.mmbk` (JSON):
```json
{
  "format": "mmbk",
  "v": 1,
  "createdAt": "2026-10-19T22:10:00Z",
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64 16 bytes>" },
  "cipher": { "name": "AES-GCM", "iv": "<base64 12 bytes>" },
  "ct": "<base64: AES-GCM( gzip( JSON do payload ) )>"
}
```
Payload em claro (antes de comprimir/cifrar): `{ app: "Billing", schema: 1, exportedAt, user: {name, email}, profile, clients, projects, timesheets, timesheet_entries, perdiem_entries, invoices, invoice_items, invoice_events, attachments: [{ meta, dataBase64? }] }`.

### 4.11 Ajustes (completos e funcionais)

Estrutura em lista agrupada estilo iOS:

1. **Conta** — nome, e-mail (alterar com confirmação).
2. **Dados para novas faturas** — Técnico · Banco · Clientes · Projetos.
3. **Faturação** — moeda padrão, taxa horária padrão, per diem padrão, padrão de numeração (com pré-visualização), próximo número, lembrete de pagamento (desligado/7/15/30/45/60 dias), início da semana.
4. **Preferências** — Idioma (Automático (idioma do aparelho) / Português (Brasil) / English), Aparência (Automático / Claro / Escuro). Guardado no perfil do utilizador e aplicado de imediato.
5. **Sincronização** — estado (online/offline), última sincronização (data e hora), alterações pendentes, "Sincronizar agora".
6. **Backup** — destinos (estado, reenviar, remover, adicionar), agendamento, incluir anexos, enviar agora, exportar, restaurar, histórico.
7. **Segurança** — alterar senha, terminar sessão em todos os dispositivos, apagar conta.
8. **Sobre** — versão, "Instalar no ecrã principal", funciona offline, link para servidor.
9. **Terminar sessão**.

### 4.12 Instalação (PWA / Adicionar ao Ecrã Principal)

| ID | Requisito |
|---|---|
| INS-01 | Ao abrir no browser (não instalada), mostrar **folha de instruções** após o login (e acessível em Ajustes › Sobre). |
| INS-02 | **iOS Safari**: passos ilustrados "Toque em Partilhar → Adicionar ao Ecrã Principal → Adicionar". Se for iOS mas não Safari (Chrome iOS, in-app browser), dizer para abrir no Safari. |
| INS-03 | **Android/Chrome**: botão "Instalar" usando `beforeinstallprompt`. |
| INS-04 | Não mostrar se já estiver em `display-mode: standalone` (ou `navigator.standalone`). "Agora não" volta a mostrar só após 14 dias (localStorage). |
| INS-05 | Manifest completo: nome, ícones 192/512/maskable, `apple-touch-icon` 180, `display: standalone`, `orientation: portrait`, cores de tema claro/escuro, splash screens iOS (`apple-touch-startup-image`) para os tamanhos de iPhone atuais. |

---

## 5. Requisitos não funcionais

### 5.1 PWA offline-first
- NF-01 **Toda a app abre e funciona offline** depois da primeira visita: assets em precache (Workbox), dados em IndexedDB (Dexie).
- NF-02 Consultar, criar, editar, mudar estado, anexar ficheiros: tudo offline, com fila de alterações pendentes.
- NF-03 **Indicador de sincronização sempre visível** no Resumo e em Ajustes: "Sincronizado · hoje 22:14", "Offline · última sincronização 18 out 21:03", "A sincronizar…", "3 alterações por enviar", "Erro ao sincronizar (tocar para detalhes)".
- NF-04 Atualizações da app: novo service worker ativa no próximo arranque; mostrar toast "Nova versão disponível · Atualizar" (não recarregar a meio de uma edição).

### 5.2 Aparência nativa (prioridade iOS)
- NF-05 Ecrã inteiro com `viewport-fit=cover` e safe areas (`env(safe-area-inset-*)`).
- NF-06 Navegação em pilha com transição horizontal iOS (entra da direita, a anterior recua com parallax), **gesto de voltar ao deslizar da borda esquerda**, títulos grandes que colapsam no scroll, barra de navegação translúcida com blur, tab bar inferior translúcida.
- NF-07 Folhas modais (sheets) que sobem de baixo com o ecrã de trás a encolher, fecháveis com arrasto para baixo; action sheets; toasts; swipe-actions nas linhas; pull-to-refresh para sincronizar.
- NF-08 Sem seleção de texto em elementos de UI, sem highlight de toque (`-webkit-tap-highlight-color: transparent`), sem overscroll "bounce" do documento (`overscroll-behavior: none`), sem menu de contexto em long-press em imagens/ícones.
- NF-09 Animações fluidas a 60 fps (apenas `transform`/`opacity`, curva `cubic-bezier(.32,.72,0,1)`), respeitando `prefers-reduced-motion`.
- NF-10 Feedback háptico quando disponível (`navigator.vibrate` no Android; no iOS não existe — não falhar).

### 5.3 Tema
- NF-11 Claro/escuro **automático por padrão** (`prefers-color-scheme`), com opção manual; aplicar sem flash na abertura (ler preferência local antes do primeiro render). `theme-color` atualizado conforme tema.

### 5.4 Idioma
- NF-12 pt-BR e en. **Padrão: idioma do dispositivo** (`navigator.languages`: qualquer `pt*` → pt-BR, resto → en). Configurável em Ajustes; guardado no perfil do utilizador (`mm_users.language`) e aplicado em todos os dispositivos.
- NF-13 **Nenhum texto visível hardcoded**: tudo por chaves i18n, ambos os idiomas completos (teste que falha se faltar uma chave).
- NF-14 Formatos de número, moeda e data por `Intl` no locale ativo.

### 5.5 Dinheiro
- NF-15 **Dinheiro sempre em cêntimos inteiros** (campos `*_cents`, tipo número inteiro). Nunca `float` para dinheiro.
- NF-16 Valor de linha = `Math.round(quantidade × taxa_cents)`; total = soma das linhas. A mesma função no cliente e no hook do servidor.
- NF-17 Input de dinheiro aceita "1.234,56", "1234.56", "1 234,5" e converte para cêntimos; teclado numérico decimal (`inputmode="decimal"`).

### 5.6 Desempenho
- NF-18 Bundle inicial ≤ 200 KB gzip; arranque a frio offline < 1,5 s num iPhone recente; listas com 1000 faturas fluidas (virtualização se necessário).

### 5.7 Acessibilidade (sem comprometer o design compacto)
- NF-19 Contraste AA, rótulos acessíveis em botões só com ícone, alvos de toque ≥ 40 px de altura mesmo com texto pequeno, foco visível com teclado.

---

## 6. Regra UX obrigatória: impedir zoom

**Problema observado:** no iPhone, ao tocar num campo de texto, o Safari faz **zoom automático** na página (acontece sempre que o `font-size` do campo é **menor que 16 px** — na versão anterior os campos tinham 13 px). Também é possível dar zoom com pinça ou duplo toque, o que quebra a sensação de app nativa.

**Requisito:** **não deve ser possível aplicar zoom na página**, nem automático (ao focar campos) nem manual (pinça / duplo toque).

O agente DEVE aplicar **todas** as medidas abaixo:

### 6.1 Meta viewport
```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover">
```

### 6.2 Campos com 16 px ou mais (causa real do zoom ao focar)
```css
/* OBRIGATÓRIO: nunca abaixo de 16px em campos editáveis, inclusive dentro de componentes compactos */
input, select, textarea, [contenteditable="true"] {
  font-size: 16px !important;   /* 16px exatos ou mais; NÃO usar rem que possa resultar < 16px */
}
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
```
- O resto da UI continua compacto (rótulos 13 px, legendas 10,5–11 px); **só o texto dentro dos campos** sobe para 16 px. Ajustar padding/altura das linhas de formulário para que continuem compactas (ex.: altura 40 px, `padding: 8px 0`, `line-height: 1.2`).
- **Proibido** o "truque" de `transform: scale()` em inputs para fingir 13 px: é frágil e desalinha o cursor.

### 6.3 Bloquear duplo toque e pinça
```css
html, body { touch-action: manipulation; }   /* remove zoom por duplo toque */
```
```ts
// main.tsx — o iOS Safari ignora user-scalable=no para pinça desde o iOS 10; bloquear o gesto:
const block = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', block, { passive: false });
document.addEventListener('gesturechange', block, { passive: false });
document.addEventListener('gestureend', block, { passive: false });
// pinça com dois dedos fora dos gestos WebKit:
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
```

### 6.4 Teste explícito (faz parte dos critérios de aceitação)
1. **Automático (Playwright, viewport iPhone 390×844, WebKit):** percorrer todos os ecrãs com formulários e verificar que `getComputedStyle(el).fontSize >= 16px` para **todos** os `input`, `select`, `textarea` visíveis. O teste falha se algum tiver menos.
2. **Automático:** verificar que o `<meta name="viewport">` contém `maximum-scale=1` e `user-scalable=no`.
3. **Manual no iPhone** (Safari e app instalada): tocar em cada campo de login, registo, fatura, linha, recebimento, ajustes, backup → **a página não pode ampliar**. Pinça e duplo toque → **sem zoom**. Registar resultado no relatório final.

---

## 7. Stack técnica

### 7.1 Backend: PocketBase (já instalado no servidor)
- **PocketBase** fornece: auth (collection do tipo `auth`), base de dados SQLite, API REST + SDK JS, armazenamento de ficheiros (com ficheiros protegidos por token), e-mail SMTP, realtime, rate limiter, logs, e **extensão em JavaScript** (`pb_hooks/*.pb.js`) e **migrações** (`pb_migrations/*.js`).
- **Não** criar nenhum servidor Node/Go adicional. Toda a lógica de servidor necessária fica em `pb_hooks` (JSVM) e regras de API das collections.
- O agente DEVE confirmar a versão instalada (`./pocketbase --version`) e usar a API correspondente (assumida **≥ 0.23**: `superusers`, `onRecordCreateRequest`, `routerAdd("POST", "/api/...", (e) => {...})`, campos `autodate`). Em desenvolvimento usar o **mesmo binário/versão** localmente.
- **Todas as collections são criadas por migrações versionadas** no repositório (`pb_migrations/`), nunca à mão no painel. Recriar do zero com `./pocketbase migrate up` deve produzir o schema completo.
- Prefixo **`mm_`** em todas as collections e uma auth collection própria **`mm_users`** (não a `users` padrão): o PocketBase do servidor pode servir outras apps; isto isola regras, templates de e-mail, política de senha e permite fechar o registo só desta app.

### 7.2 Frontend
| Camada | Escolha | Porquê |
|---|---|---|
| Build | **Vite** + **TypeScript** (strict) | Rápido, PWA plugin maduro |
| UI | **React 19** | Ecossistema, já usado no protótipo funcional |
| Estilos | **CSS próprio com variáveis** (tokens iOS do protótipo 01) + CSS Modules ou ficheiros prefixados | Controlo fino do visual iOS; o protótipo já define tokens e componentes; evita lutar com utilitários para blur/safe-areas/animações |
| Navegação | Navegador **em pilha próprio** (push/pop animado + gesto de borda) por cima de tabs; URLs sincronizadas com `history` para deep links (`/faturas/:id`, links de e-mail) | Transições nativas que routers genéricos não dão |
| Dados remotos | **pocketbase** (SDK JS oficial) | Auth, CRUD, ficheiros, realtime |
| Dados locais | **Dexie** (IndexedDB) + `liveQuery` para UI reativa | Consultas offline, índices, transações |
| Validação | **Zod** | Mesmos schemas para formulários, IndexedDB, restauro de backup |
| PWA | **vite-plugin-pwa** (Workbox, `injectManifest` ou `generateSW`) | Precache, atualização controlada |
| Cripto | **WebCrypto** (PBKDF2, AES-GCM) + `CompressionStream('gzip')` | Nativo, sem dependências |
| Gráficos | SVG próprio (barras simples) | Leve, temável |
| Testes | **Vitest** (unidade) + **Playwright** (E2E, WebKit + Chromium, contra PocketBase local) | |
| Qualidade | ESLint + Prettier + `tsc --noEmit` | |

Dependências de runtime devem ficar mínimas (react, react-dom, pocketbase, dexie, zod). Nada de bibliotecas de UI pesadas.

---

## 8. Modelo de dados no PocketBase

### 8.1 Convenções comuns
Todas as collections de dados (exceto `mm_users`) têm:

| Campo | Tipo PB | Regras |
|---|---|---|
| `id` | text (PK) | 15 caracteres `[a-z0-9]`, **gerado no cliente** (permite criar offline sem mapeamento de ids). |
| `owner` | relation → `mm_users` (single, required, **cascadeDelete**) | Sempre = utilizador autenticado. |
| `rev` | number (int, min 1) | Incrementado a cada alteração; usado para deteção de conflitos (§10). |
| `deleted_at` | date (opcional) | Soft delete (para propagar apagamentos entre dispositivos). |
| `created` | autodate (onCreate) | |
| `updated` | autodate (onCreate + onUpdate) | Cursor de sincronização. |

Índice em todas: `CREATE INDEX idx_<col>_owner_updated ON <col> (owner, updated)`.

**Regras de API padrão** (aplicar a todas as collections de dados, salvo indicação):
```
listRule:   owner = @request.auth.id
viewRule:   owner = @request.auth.id
createRule: @request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id
updateRule: owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)
deleteRule: null        // apagamento só por soft delete (update de deleted_at); hard delete só via cascade/rotas próprias
```
Relações para outras collections DEVEM ser validadas no hook (o registo relacionado tem de ter o mesmo `owner`), além de nas regras quando possível (ex.: `@request.body.invoice.owner = @request.auth.id`).

Ficheiros: todos os campos `file` com **`protected: true`** (download só com file token do utilizador dono), `maxSize: 10485760`, `mimeTypes: ["application/pdf","image/jpeg","image/png"]`.

### 8.2 `mm_users` (auth)
| Campo | Tipo | Notas |
|---|---|---|
| `email`, `password`, `verified`, `tokenKey`, `emailVisibility` | built-in | `emailVisibility = false` |
| `name` | text, 1–120, required | |
| `language` | select: `auto`, `pt-BR`, `en` | default `auto` |
| `theme` | select: `auto`, `light`, `dark` | default `auto` |

Opções: `authRule: verified = true`; senha mín. 10, máx. 128; métodos: apenas password (OTP/MFA podem ficar desligados no MVP); duração de token de auth **7 dias** (renovado com `authRefresh`), verificação 48 h, reset 30 min, mudança de e-mail 1 h. Templates de e-mail com URL da app (`{APP_URL}/verificar-email?token={TOKEN}` etc.).
Regras: `listRule`/`viewRule`/`updateRule`: `id = @request.auth.id`; `createRule`: `""` só enquanto o registo estiver aberto, depois `null`; `deleteRule`: `null` (apagar via rota §9).
Hook: ao criar utilizador, criar o registo `mm_profiles` correspondente com valores por omissão.

### 8.3 `mm_profiles` (1 por utilizador)
| Campo | Tipo | Notas |
|---|---|---|
| `currency` | select `EUR, USD, GBP, CHF, BRL` | default EUR |
| `default_hourly_rate_cents` | number int ≥ 0 | |
| `default_perdiem_cents` | number int ≥ 0 | |
| `invoice_number_pattern` | text ≤ 40 | default `{YYYY}-{SEQ}` |
| `next_invoice_seq` | number int 1–999999 | |
| `payment_reminder_days` | number int 0–365 | 0 = desligado; default 30 |
| `week_starts_on` | number int 0 ou 1 | 1 = segunda |
| `tech_name`, `tech_company`, `tech_email`, `tech_address`, `tech_vat`, `tech_tel` | text | Technician |
| `bank_iban_name`, `bank_iban`, `bank_swift` | text | IBAN normalizado |
| `default_client` | relation → `mm_clients` | opcional |
| `default_project` | relation → `mm_projects` | opcional |
| `backup_schedule` | select `off, weekly, monthly` | |
| `backup_destinations` | relation → `mm_backup_destinations` (multi, máx 5) | |
| `backup_include_attachments` | bool | |
| `backup_last_at`, `backup_next_at` | date | |

Índice único: `(owner)`. createRule `null` (criado pelo hook); deleteRule `null`.

### 8.4 `mm_clients`
`name` (text 1–160, req), `address` (text ≤ 300), `vat` (≤ 40), `email` (email, opcional — para onde as faturas são enviadas), `notes` (≤ 1000), `archived` (bool).

### 8.5 `mm_projects`
`client` (rel → mm_clients, req), `name` (1–160, req), `role` (≤ 120), `start_date` (date), `end_date` (date), `location` (≤ 160), `hourly_rate_cents` (int), `perdiem_cents` (int), `currency` (select), `archived` (bool).

### 8.6 `mm_timesheets`
| Campo | Tipo | Notas |
|---|---|---|
| `project` | rel → mm_projects, req | |
| `week_start`, `week_end` | date (`YYYY-MM-DD`), req | `week_end = week_start + 6` |
| `status` | select `draft, submitted, approved` | |
| `submitted_at` | date | |
| `total_hours` | number (2 decimais) | **calculado no hook** = soma das entradas |
| `file` | file (protected) | PDF/imagem da timesheet |
| `notes` | text ≤ 1000 | |

Índice único: `(owner, project, week_start) WHERE deleted_at = ''`.

### 8.7 `mm_timesheet_entries`
`timesheet` (rel, req, cascadeDelete), `date` (date, req, dentro da semana), `hours` (number 0–24, 2 decimais), `note` (≤ 300), `invoice` (rel → mm_invoices, opcional: preenchido quando o dia é faturado).
Índice único: `(timesheet, date) WHERE deleted_at = ''`.

### 8.8 `mm_perdiem_entries`
`project` (rel, req), `date` (date, req), `kind` (select `perdiem, meal, lodging, travel, mileage, other`), `description` (≤ 300), `quantity` (number ≥ 0, 2 dec.), `rate_cents` (int), `amount_cents` (int, **calculado no hook**), `receipt` (file protected), `invoice` (rel → mm_invoices, opcional).

### 8.9 `mm_invoices`
| Campo | Tipo | Notas |
|---|---|---|
| `type` | select `hours, expenses`, req | |
| `number` | text 1–40, req | único por owner (não apagadas) |
| `invoice_date` | date, req | |
| `period_start`, `period_end` | date, req | `period_end ≥ period_start` (hook) |
| `currency` | select | |
| `status` | select `draft, sent, confirmed, paid, cancelled` | transições validadas no hook |
| `client` | rel → mm_clients | |
| `project` | rel → mm_projects | |
| `technician` | json | snapshot `{name, company, email, address, vat, tel}` |
| `bank` | json | snapshot `{ibanName, iban, swift}` |
| `client_snapshot` | json | `{name, address, vat, email}` |
| `project_snapshot` | json | `{name, role, startDate, endDate, location}` |
| `total_cents` | number int | **recalculado no hook** a partir de `mm_invoice_items` |
| `sent_at`, `confirmed_at`, `paid_at` | date | |
| `received_cents` | number int | obrigatório se `paid` |
| `difference_cents` | number int | hook: `received_cents − total_cents` |
| `payment_note` | text ≤ 1000 | |
| `notes` | text ≤ 2000 | |

Índices: `UNIQUE (owner, number) WHERE deleted_at = ''`; `(owner, invoice_date)`; `(owner, status)`; `(owner, paid_at)`.
Os schemas JSON dos snapshots DEVEM ser validados (no cliente com Zod e no hook com verificação de chaves/tipos/tamanho).

### 8.10 `mm_invoice_items`
`invoice` (rel, req, cascadeDelete), `position` (int), `description` (1–300, req), `quantity` (number 0–100000, máx 2 decimais), `unit` (select `h, day, unit, km`), `rate_cents` (int ≥ 0), `amount_cents` (int, **calculado no hook** = `round(quantity × rate_cents)`), `date_from`, `date_to` (date, opcionais).
Máx. 100 itens por fatura (hook).

### 8.11 `mm_invoice_events` (histórico, só leitura para o utilizador)
`invoice` (rel, cascadeDelete), `from_status`, `to_status` (select), `at` (date: a data do evento indicada pelo utilizador), `note` (≤ 500).
createRule/updateRule/deleteRule: `null` — criado **apenas pelo hook** quando `mm_invoices.status` muda.

### 8.12 `mm_attachments`
`invoice` (rel, req, cascadeDelete), `kind` (select `invoice_pdf, payment_proof, confirmation, receipt, other`), `file` (file protected, req), `file_name` (≤ 200), `size_bytes` (int), `sha256` (text 64 hex, calculado no cliente e verificado no hook).
Hook: valida **magic bytes** (PDF `%PDF`, JPEG `FF D8 FF`, PNG `89 50 4E 47`) além do mime declarado.

### 8.13 `mm_backup_destinations`
| Campo | Tipo | Notas |
|---|---|---|
| `email` | email, req | |
| `status` | select `pending, verified` | |
| `verified_at` | date | |
| `token_hash` | text, **hidden** | SHA-256 do token |
| `token_expires` | date, **hidden** | |
| `last_sent_at` | date | |

listRule/viewRule: `owner = @request.auth.id`; deleteRule: `owner = @request.auth.id`; **createRule/updateRule: `null`** (só via rotas próprias, §9). Índice único `(owner, email)`.

### 8.14 `mm_backup_logs`
`kind` (select `email, export, restore`), `destinations` (json array de e-mails), `size_bytes` (int), `status` (select `ok, error`), `error` (text ≤ 500).
list/view: owner; create: owner (para `export`/`restore` registados pelo cliente) — `email` é criado só pela rota de envio; update/delete: `null`.

### 8.15 Diagrama
```
mm_users 1─1 mm_profiles
mm_users 1─* mm_clients 1─* mm_projects 1─* mm_timesheets 1─* mm_timesheet_entries ─*→ mm_invoices
                                   └─* mm_perdiem_entries ─*→ mm_invoices
mm_users 1─* mm_invoices 1─* mm_invoice_items
                         1─* mm_invoice_events
                         1─* mm_attachments
mm_users 1─* mm_backup_destinations, mm_backup_logs
```

---

## 9. Lógica no servidor (pb_hooks) e rotas próprias

### 9.1 Hooks de validação (`pb_hooks/*.pb.js`)
| Evento | Lógica |
|---|---|
| Criar/atualizar qualquer registo de dados | `owner` = auth; relacionados com o mesmo `owner`; `rev` novo = `rev` atual + 1, senão **409** (conflito); normalizar textos (trim). |
| `mm_invoice_items` create/update/delete | `amount_cents = round(quantity × rate_cents)`; recalcular `mm_invoices.total_cents` e `difference_cents`; recusar se a fatura estiver `paid` (exceto se vier junto com a mudança de estado). |
| `mm_invoices` update | Validar transição de estado (§4.5 INV-08); `paid` exige `paid_at` e `received_cents`; criar `mm_invoice_events`; período válido; soft delete liberta `invoice` nas timesheet entries e perdiem entries ligadas. |
| `mm_timesheet_entries` | Data dentro da semana; recalcular `total_hours`. |
| `mm_perdiem_entries` | `amount_cents = round(quantity × rate_cents)`. |
| `mm_attachments` | magic bytes, tamanho, sha256. |
| `mm_users` after create | Criar `mm_profiles` com defaults e `language` do registo. |
| E-mails de auth | `onMailerRecordVerificationSend` / `PasswordResetSend` / `EmailChangeSend`: escolher template pt-BR ou en segundo `language` do utilizador (`auto` → pt-BR se o `Accept-Language` do pedido for pt, senão en). |

### 9.2 Rotas próprias (`routerAdd`)
Todas com `$apis.requireAuth("mm_users")` exceto as marcadas como públicas, validação de input, e rate limit (§11).

| Método e rota | Descrição |
|---|---|
| `POST /api/mm/backup/destinations` `{email}` | Cria destino `pending` (máx 5, sem duplicados), gera token, envia e-mail de confirmação **ao destino**. |
| `POST /api/mm/backup/destinations/{id}/resend` | Novo token (invalida o anterior), reenvia. Máx 3 por hora por destino. |
| `POST /api/mm/backup/destinations/verify` `{token}` — **pública** | Hash do token → destino `pending` não expirado → `verified`, limpa token. Resposta genérica se inválido. |
| `POST /api/mm/backup/send` multipart `{destinations[], file}` | Verifica destinos do utilizador e `verified`; ficheiro ≤ 15 MB e com estrutura `.mmbk` válida (JSON com `format:"mmbk"`, `v`, `kdf`, `cipher`, `ct`); envia e-mail com anexo para cada destino; atualiza `last_sent_at`, `backup_last_at`; regista `mm_backup_logs`. Máx 10 envios/dia. |
| `POST /api/mm/account/logout-all` | Regenera `tokenKey` do utilizador (invalida todos os tokens) e devolve novo token para o dispositivo atual. |
| `POST /api/mm/account/delete` `{password}` | Verifica senha; apaga utilizador (cascade apaga tudo e os ficheiros). |

Se a versão do PocketBase instalada não suportar anexos binários no `MailerMessage` pela JSVM, o fallback é: guardar o `.mmbk` num registo temporário protegido e enviar no e-mail um **link de download de uso único com validade de 7 dias** (token com hash, igual ao de verificação). O agente DEVE testar qual das duas funciona e documentar.

### 9.3 Cron (`cronAdd`)
- Diariamente: apagar tokens de destino expirados; apagar ficheiros temporários de backup expirados; limpar soft deletes com mais de 90 dias **já sincronizados** (opcional, documentar).

---

## 10. Offline e sincronização

### 10.1 Armazenamento local (Dexie)
- Uma tabela por collection (mesmos campos, mesmos ids) + índices para as consultas da UI (`[owner+invoice_date]`, `status`, `paid_at`, `project`, `date`).
- `outbox`: `{ seq, collection, recordId, op: 'upsert'|'delete', baseRev, createdAt, attempts, lastError }` — uma entrada por registo (coalescer: várias edições do mesmo registo = uma entrada).
- `files`: blobs de anexos (`recordId`, `field`, `blob`, `uploaded: bool`) — anexos visíveis offline.
- `meta`: `lastSyncAt`, `cursor` por collection (último `updated` visto), `userCache` (para abrir offline), chave de backup agendado.

### 10.2 Escrita (optimistic UI)
1. Validar com Zod → gravar na tabela local (com `rev + 1` local e `updated` local) → entrada no `outbox` → UI atualiza imediatamente.
2. Disparar sincronização com debounce de 1,5 s.

### 10.3 Ciclo de sincronização
Disparado: ao abrir a app, no evento `online`, ao voltar a primeiro plano (`visibilitychange`), após mutações (debounce), a cada 5 min em primeiro plano, por pull-to-refresh e "Sincronizar agora". Um ciclo de cada vez (mutex).

1. **Push** do `outbox` por ordem de dependências: `clients → projects → timesheets → timesheet_entries → perdiem_entries → invoices → invoice_items → attachments → profiles`.
   - Criar: `create` com o `id` gerado no cliente; se já existir (retry), tratar como update.
   - Atualizar: `update` com `rev = baseRev + 1`.
   - Apagar: update com `deleted_at`.
   - Ficheiros: multipart (`FormData`) ao criar/atualizar o registo.
   - **409 (conflito de rev)**: o servidor ganha; descartar a alteração local desse registo, buscar a versão do servidor, mostrar toast "Alteração em conflito: foi mantida a versão mais recente" e registar o conflito.
   - **400 (validação)**, ex.: número de fatura duplicado: manter localmente, marcar o registo com erro visível ("Corrigir") e não bloquear o resto da fila.
   - Erros de rede: parar, retry com backoff (2 s, 4 s, 8 s… até 5 min).
2. **Pull** por collection: `getFullList({ filter: 'updated > "<cursor>"', sort: 'updated' })` (paginado), upsert local (se não houver alteração pendente para o mesmo registo), avançar cursor.
3. Gravar `lastSyncAt = agora` só se push e pull terminaram sem erro.
4. **Realtime** (opcional, DEVERIA): com a app aberta e online, subscrever as collections do utilizador e aplicar alterações vindas de outros dispositivos.

### 10.4 Sessão offline
- Abrir offline com sessão anterior → entra com `userCache` e dados locais; sync quando online. Se o `authRefresh` devolver 401, pedir login **sem apagar** os dados locais nem o `outbox`; após login com o **mesmo** utilizador, continuar a sincronizar. Login de outro utilizador → apagar dados locais (avisar se há pendentes).
- Terminar sessão → apagar toda a base local, blobs e chave de backup.

### 10.5 Service worker
- Precache de todos os assets do build; `navigateFallback` para `index.html` (excluir `/api/` e `/_/`).
- **Não** colocar respostas da API do PocketBase em cache do service worker (os dados vivem no IndexedDB). Ficheiros protegidos também não.

---

## 11. Segurança

| Área | Requisito |
|---|---|
| Transporte | HTTPS obrigatório (Let's Encrypt), HSTS `max-age=31536000; includeSubDomains`. |
| Senhas | Hash bcrypt do PocketBase; mínimo 10 caracteres; nunca registar senhas/tokens em logs. |
| Tokens | O PocketBase usa tokens (JWT) no `Authorization`, guardados pelo SDK no `localStorage`. **Não há cookies de sessão** → CSRF não se aplica; a defesa principal é **impedir XSS**: CSP rígida, nenhum script de terceiros, nenhum `dangerouslySetInnerHTML`, sanitização de nomes de ficheiro. Token de 7 dias com renovação; "terminar sessão em todos" regenera `tokenKey`. |
| CSP | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; worker-src 'self'; manifest-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (se for necessário `style-src 'unsafe-inline'` para atributos `style`, usar apenas `style-src-attr 'unsafe-inline'`). |
| Outros headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`. |
| Isolamento de dados | Regras de API por `owner` em todas as collections; hooks validam relações do mesmo dono; ficheiros `protected`. **Teste automático** de que um utilizador B não lê/edita/apaga nada do A (lista, view, update, ficheiros, rotas próprias). |
| Rate limiting | Rate limiter nativo do PocketBase ativado: `*:authWithPassword` 5/min por IP, `*:requestPasswordReset` e `*:requestVerification` 3/10 min, rotas `/api/mm/*` 20/min; mais `limit_req` no nginx para `/api/`. |
| Enumeração | Respostas genéricas em login, recuperação e verificação de destino. |
| Painel admin | `/_/` do PocketBase restrito por IP (nginx `allow/deny`) ou por autenticação adicional; superuser com MFA ativado. |
| Backups | Cifrados no dispositivo (AES-256-GCM, PBKDF2-SHA-256 600k); servidor só vê dados cifrados; só para destinos verificados. |
| Uploads | Tamanho, mime, magic bytes, nomes sanitizados, sem execução; servidos com `Content-Disposition` apropriado. |
| Dados locais | IndexedDB depende da proteção do dispositivo (código/Face ID); logout apaga tudo. |
| Dependências | Mínimas, versões fixadas, `npm audit` sem vulnerabilidades altas. |
| Backups do servidor | Documentar backup do diretório `pb_data` (o PocketBase tem backups nativos em Settings › Backups) — agendar diário. |

---

## 12. Fluxos principais passo a passo

### 12.1 Primeiro uso
1. Abre o URL no Safari → ecrã de login (com link "Criar conta").
2. Criar conta (nome, e-mail, senha, idioma) → "Verifique o seu e-mail".
3. Clica no link do e-mail → `/verificar-email?token=…` → "E-mail confirmado" → Entrar.
4. Após login: folha "Instale o Billing" (iOS: passos Partilhar → Adicionar ao Ecrã Principal).
5. Onboarding curto (3 passos, pode saltar): dados do técnico → banco → cliente e projeto (com taxa horária e per diem).
6. Resumo vazio com "Criar primeira fatura".

### 12.2 Semana de trabalho
1. Tab Timesheets → "+" → projeto predefinido, semana atual → horas por dia (teclado decimal) → Guardar (offline OK).
2. Ao enviar a timesheet à empresa: "Marcar como enviada" (+ anexar PDF opcional).

### 12.3 Criar fatura de horas
1. Resumo → "+" → "Fatura de horas".
2. Pré-preenchido: número (`2026-014`), data (hoje), período (sugerido), técnico/banco/cliente/projeto (snapshot).
3. "Gerar linhas das timesheets" → uma linha por semana dentro do período (mostra semanas já faturadas como indisponíveis).
4. Revê linhas e total → Anexar PDF da fatura → Guardar como **rascunho** ou **Emitir** (estado `sent` com data de envio).
5. Próximo número incrementa. Fica na lista "Pendentes".

### 12.4 Criar fatura de despesas / per diem
Igual, com "Gerar linhas do per diem e despesas" (ou "Per diem do período" para criar as entradas em falta).

### 12.5 Confirmação de receção e recebimento com conferência
1. A empresa confirma a receção → abrir fatura → "Receção confirmada" → data (hoje, editável) → estado `confirmed`.
2. Dinheiro entra na conta → "Marcar como recebida" → folha com **valor recebido** (pré-preenchido com o total) e **data** → mostra diferença em tempo real → nota (se diferença) → anexar comprovativo (opcional) → Confirmar.
3. Estado `paid` com selo "Conferido" (diferença 0) ou "Diferença −12,50 €" (alerta no Resumo).

### 12.6 Relatório
Tab Relatórios → escolher Ano 2026 → base "Data de recebimento" → ver total recebido, gráfico por mês, horas faturadas; trocar para "Personalizado" 28/09–25/10 → filtrar projeto → Exportar CSV.

### 12.7 Backup por e-mail
1. Ajustes → Backup → "Adicionar e-mail" → `robert.backup@…` → estado "A aguardar confirmação".
2. Nesse e-mail, clica "Confirmar" → página da app "Este endereço vai passar a receber backups".
3. Volta a Ajustes → destino "Verificado" → "Enviar backup agora" → escolhe destino, frase-passe (2×), incluir anexos → app gera, comprime, cifra e envia → toast "Backup enviado" → histórico.
4. (Opcional) Agendar mensal → frase-passe uma vez → próximos envios automáticos ao abrir a app.
5. Restaurar: Ajustes → Backup → Restaurar → escolher `.mmbk` → frase-passe → resumo → Juntar.

### 12.8 Offline
Sem rede: indicador "Offline · última sincronização 18 out 21:03"; criar/editar normalmente; contador "2 alterações por enviar"; ao voltar a rede sincroniza sozinho e o indicador passa a "Sincronizado · agora".

---

## 13. Ecrãs e navegação

**Tab bar (5):** Resumo · Faturas · Timesheets · Relatórios · Ajustes.

| Ecrã | Conteúdo principal |
|---|---|
| Login / Criar conta / Recuperar senha | Ecrãs simples, logotipo, campos 16 px, botão principal, links secundários. |
| Páginas públicas | `/verificar-email`, `/redefinir-senha`, `/confirmar-email` (mudança de e-mail), `/confirmar-backup` — funcionam sem login. |
| Resumo | §4.7. |
| Faturas (lista) | Título grande, pesquisa, segmented filter, grupos por mês, swipe actions, "+". |
| Detalhe da fatura | Cabeçalho (tipo, nº, valor grande, estado), linha do tempo de estados com ação do próximo passo, conferência, discriminação de linhas, período, dados (técnico/banco/cliente/projeto colapsáveis), anexos, notas, ações (editar, duplicar, partilhar PDF, apagar). |
| Nova/Editar fatura | Formulário agrupado: tipo, nº, data, período (dois date pickers), cliente/projeto, linhas (adicionar/gerar), total, anexos, secções colapsáveis com snapshot. Botões Cancelar/Guardar na nav bar. Aviso ao sair com alterações. |
| Marcar recebida | Sheet §12.5. |
| Timesheets | Lista por mês (semana, projeto, horas, estado, faturada?). Detalhe com 7 dias e total. |
| Despesas / Per diem | Acesso a partir de Timesheets (segmented "Horas · Despesas") — lista por data, detalhe com recibo. |
| Relatórios | §4.8. |
| Ajustes | §4.11 e sub-ecrãs. |
| Instalar | Sheet §4.12. |

Rotas (deep links): `/`, `/faturas`, `/faturas/:id`, `/faturas/nova?tipo=hours`, `/timesheets`, `/timesheets/:id`, `/relatorios`, `/ajustes/...`, mais as públicas acima. O botão voltar do Android e do browser fazem pop na pilha.

---

## 14. Design

### 14.1 Referência
**`prototipos/01-ios-nativo.html`** (pasta partilhada do projeto) é a referência visual escolhida pelo Robert — **em versão mais compacta** (textos e elementos pequenos para aproveitar o espaço). A implementação anterior (`apps/web/src/ui/styles.css` no repositório) já portou estes tokens e pode ser reutilizada como ponto de partida, **com a correção dos campos para 16 px** (§6).

### 14.2 Tokens
```css
:root{
  --bg:#f2f2f7; --bg2:#fff; --bg3:#f2f2f7;
  --fill:rgba(120,120,128,.12); --fill2:rgba(120,120,128,.08);
  --label:#000; --label2:rgba(60,60,67,.6); --label3:rgba(60,60,67,.3); --sep:rgba(60,60,67,.18);
  --blue:#007aff; --green:#34c759; --orange:#ff9500; --red:#ff3b30; --indigo:#5856d6; --teal:#30b0c7; --gray:#8e8e93;
  --bar:rgba(249,249,249,.84);
  --ease:cubic-bezier(.32,.72,0,1);
  --top:env(safe-area-inset-top,0px); --bot:max(env(safe-area-inset-bottom,0px),10px);
}
/* escuro: --bg:#000; --bg2:#1c1c1e; --bg3:#2c2c2e; --label:#fff; --blue:#0a84ff; --green:#30d158; --orange:#ff9f0a; --red:#ff453a; ... */
```
Tipografia: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif`; números com `font-variant-numeric: tabular-nums`.

| Elemento | Tamanho |
|---|---|
| Título grande | 26 px / 700 |
| Título da nav bar | 14 px / 600 |
| Texto de linha | 13 px |
| Subtexto / cabeçalhos de secção (maiúsculas) | 10,5–11 px |
| Valor em destaque (detalhe) | 30 px / 700 |
| Tab bar | 9,5 px |
| **Campos editáveis** | **16 px (obrigatório)** |

Cores de estado: Rascunho cinza · Enviada azul · Confirmada índigo · Recebida verde · Atraso laranja · Diferença laranja · Anulada vermelho.

### 14.3 Componentes-chave (kit de UI)
NavBar com título grande colapsável · TabBar translúcida com badge · Lista agrupada (inset grouped) com linhas, ícones coloridos 26 px, chevron, valor à direita · Linha de formulário (rótulo à esquerda, input 16 px à direita) · Segmented control animado · Search field · Pills de estado · Botões (primário, secundário, destrutivo, pequeno) · Sheet modal com arrasto · Action sheet · Alert de confirmação · Toast · Swipe actions · Pull-to-refresh · Date picker (input nativo `type=date` estilizado) · Stepper · Toggle iOS · Empty state · Skeleton · Gráfico de barras · Indicador de sincronização (ponto + texto) · Visualizador de PDF/imagem.

---

## 15. Infraestrutura e deploy

### 15.1 Situação atual (contexto)
- Servidor próprio (contentor LXC Debian) com **nginx** + **Let's Encrypt** e o **PocketBase já instalado e a correr**.
- A versão anterior foi publicada em `https://pwa.windlog.org/Billing/` (PocketBase na raiz do mesmo domínio). Também foi referido `Billing.windlog.org`. **O domínio/caminho final deve ser configurável** e confirmado com o Robert; recomenda-se subdomínio próprio (`Billing.windlog.org`) para isolar origem, service worker e `localStorage`.

### 15.2 Topologia recomendada (mesma origem, sem CORS)
```
https://Billing.windlog.org/            → nginx: ficheiros estáticos do build (web/dist)
https://Billing.windlog.org/api/        → proxy para PocketBase (127.0.0.1:8090)
https://Billing.windlog.org/_/          → painel PocketBase (restrito por IP)
```
Alternativa válida: servir o build pela pasta `pb_public` do PocketBase. Se o PocketBase servir outras apps no mesmo processo, manter a app no seu próprio vhost a fazer proxy para a mesma instância.

Exemplo nginx (o agente DEVE entregar o ficheiro completo):
```nginx
server {
  listen 443 ssl http2;
  server_name Billing.windlog.org;
  # ssl_certificate ... (certbot)
  root /var/www/Billing;
  client_max_body_size 20m;

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy no-referrer always;

  location /api/ { proxy_pass http://127.0.0.1:8090; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_http_version 1.1; proxy_set_header Connection ''; proxy_buffering off; proxy_read_timeout 360s; }
  location /_/  { allow <IP_DO_ROBERT>; deny all; proxy_pass http://127.0.0.1:8090; }
  location = /sw.js { add_header Cache-Control "no-cache"; }
  location = /index.html { add_header Cache-Control "no-cache"; }
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location / { try_files $uri /index.html; }
}
```
(Repetir os `add_header` de segurança nos `location` que definem os seus próprios `add_header`.)

### 15.3 Configuração
- Frontend: `VITE_PB_URL` (default: mesma origem `/`), `VITE_BASE` (default `/`), `VITE_APP_URL`.
- PocketBase: SMTP (Settings › Mail), `Application URL` = URL da app, rate limits, backups automáticos do `pb_data`, trusted proxy (`X-Forwarded-For`).
- Deploy: `npm run build` → copiar `web/dist` para o servidor; copiar `pocketbase/pb_migrations` e `pocketbase/pb_hooks` para a pasta do PocketBase e reiniciar o serviço (`systemctl restart pocketbase`) — as migrações aplicam-se no arranque. Fornecer script `deploy.sh` (rsync + restart) parametrizado por variáveis.

---

## 16. Estrutura do repositório

```
Billing/
  web/                      # PWA (Vite + React + TS)
    public/                 # ícones, splash iOS, robots.txt
    src/
      app/                  # casca: providers, tabs, navegador em pilha, rotas
      ui/                   # kit de componentes iOS + tokens CSS
      domain/               # lógica pura: money.ts, dates.ts, invoice.ts, numbering.ts, schemas (zod)
      data/                 # pb client, Dexie db, repositórios, sync engine, outbox, files
      features/
        auth/ invoices/ timesheets/ expenses/ reports/ settings/ backup/ install/
      i18n/                 # pt-BR.ts, en.ts, t()
      main.tsx
    index.html              # meta viewport §6.1
    vite.config.ts
  pocketbase/
    pb_migrations/          # criação de TODAS as collections, índices e regras
    pb_hooks/               # validações, cálculos, rotas /api/mm/*, cron, e-mails pt-BR/en
    email_templates/        # HTML pt-BR/en (verificação, reset, mudança de e-mail, destino de backup, backup)
  e2e/                      # Playwright
  deploy/                   # nginx.conf, deploy.sh, systemd unit de exemplo
  scripts/                  # dev: baixar binário PocketBase da mesma versão, seed de dados
  README.md
  REQUISITOS.md             # este documento
```
Camadas no frontend: **UI (features + ui) → domain (puro, testável) → data (Dexie/PocketBase)**. Componentes nunca chamam o SDK do PocketBase diretamente; só através de `data/`.

---

## 17. Testes

| Tipo | Âmbito mínimo |
|---|---|
| Unidade (Vitest) | `money` (parse/format/arredondamento), `dates` (formatPeriod nos 4 casos, semanas recortadas, sobreposição com mês, viragem de ano, horário de verão), numeração, transições de estado, geração de linhas a partir de timesheets/per diem, cifra/decifra `.mmbk` ida-e-volta e frase-passe errada, i18n com chaves completas nos dois idiomas. |
| Integração (contra PocketBase local, migrações aplicadas) | Regras de acesso: utilizador B não acede a nada do A; totais recalculados pelo servidor ignoram total enviado pelo cliente; conflito de `rev` → 409; número duplicado → 400; transições inválidas recusadas; destino não verificado recusado; token de destino expira e é de uso único; upload com mime falso recusado. |
| E2E (Playwright, WebKit iPhone + Chromium Android) | Registo → verificação (ler e-mail via servidor SMTP de teste, ex.: Mailpit) → login → onboarding → timesheet → fatura de horas com linhas geradas → anexo PDF → enviada → confirmada → recebida com diferença → relatório → backup (destino → confirmação → envio) → restauro; **offline** (`context.setOffline(true)`): criar e editar fatura, voltar online e verificar sincronização e `lastSyncAt`; **zoom** (§6.4); tema escuro; idioma en. |
| Manual (iPhone real) | Instalação no ecrã principal, abertura offline em modo avião, gesto de voltar, zoom (§6.4), safe areas com notch/Dynamic Island. |

---

## 18. Critérios de aceitação

A entrega só é aceite quando **todos** os pontos abaixo forem verdadeiros:

1. `pocketbase migrate up` numa instância vazia cria todas as collections, campos, índices e regras deste documento; nenhuma configuração manual no painel além de SMTP e superuser.
2. Registo, verificação de e-mail, login, recuperação de senha, mudança de e-mail, alterar senha, terminar todas as sessões e apagar conta funcionam de ponta a ponta com e-mails reais (pt-BR e en).
3. Registo pode ser fechado; com o registo fechado, criar conta falha.
4. Um segundo utilizador não consegue ler, alterar, apagar ou descarregar nada do primeiro (teste automático a passar).
5. Criar fatura de horas a partir de timesheets e fatura de despesas a partir de per diem, com período a cruzar meses (28/09–25/10), produz linhas e totais corretos e formatação de período correta nos dois idiomas.
6. O total gravado é sempre o recalculado pelo servidor; dinheiro guardado em cêntimos inteiros em todo o lado.
7. Fluxo de estados completo, com histórico; "marcar como recebida" regista valor e data e mostra a diferença; alertas de atraso e diferença aparecem no Resumo.
8. PDF da fatura anexado é visível offline e após reinstalar/sincronizar noutro dispositivo.
9. Relatórios por mês/trimestre/ano/personalizado, com base em data da fatura, de recebimento e período trabalhado, batem certo com os dados de teste; CSV exportado.
10. **Offline:** em modo avião a app abre, mostra todos os dados, permite criar/editar/mudar estado/anexar; ao voltar a rede sincroniza sozinha; indicador mostra data e hora da última sincronização; nenhuma alteração perdida.
11. Dois dispositivos com a mesma conta convergem para os mesmos dados (incluindo apagamentos); conflito resolvido sem perda silenciosa (toast).
12. Backup: destino só recebe após confirmar pelo link; envio para não verificado recusado pelo servidor; ficheiro recebido decifra com a frase-passe certa e falha com a errada; restaurar junta dados sem apagar; exportação local funciona offline; agendamento envia ao abrir a app quando vencido.
13. **Zoom:** nenhum zoom ao focar qualquer campo no iPhone (Safari e app instalada); pinça e duplo toque não ampliam; teste automático de `font-size ≥ 16px` em todos os campos a passar.
14. Instalação: folha de instruções aparece no Safari iOS e botão "Instalar" no Chrome Android; não aparece quando instalada; app instalada abre em ecrã inteiro com ícone e splash.
15. Tema automático claro/escuro sem flash; opção manual funciona e fica guardada no perfil.
16. Idioma segue o aparelho por omissão; alteração em Ajustes aplica-se de imediato e persiste no perfil (outro dispositivo recebe-a).
17. Aparência e interação nativas iOS conforme §5.2 e §14 (transições, gesto de voltar, sheets, swipe actions, safe areas).
18. Headers de segurança presentes (verificar com `curl -I`), CSP sem `unsafe-eval` nem scripts inline, painel `/_/` inacessível de fora.
19. `tsc --noEmit`, lint, testes unitários, de integração e E2E verdes; Lighthouse PWA "installable" e desempenho ≥ 90 em mobile.

---

## 19. Entregáveis

1. **Código-fonte** no repositório `robertruas/Billing` (estrutura §16), substituindo a implementação anterior (o código antigo em `apps/server` deixa de existir; pode ficar no histórico git).
2. **`pocketbase/pb_migrations`** e **`pocketbase/pb_hooks`** completos e versionados.
3. **README.md** com:
   - requisitos (Node LTS, versão exata do PocketBase);
   - **desenvolvimento local**: `scripts/dev-pocketbase.sh` baixa a mesma versão do PocketBase, aplica migrações, cria superuser e utilizador de teste; Mailpit para e-mails; `npm run dev` com proxy Vite para `/api`;
   - **testes**: como correr unidade, integração e E2E;
   - **deploy no servidor** (§15): build, copiar migrations/hooks, reiniciar PocketBase, nginx, SMTP, abrir/fechar registo, backups do `pb_data`;
   - como testar a PWA no iPhone (instalar, modo avião, zoom).
4. **`deploy/`**: `nginx.conf`, `deploy.sh`, exemplo de unit systemd do PocketBase.
5. **Templates de e-mail** pt-BR/en.
6. **PWA testável** publicada no servidor (se o Robert der acesso) ou instruções exatas para publicar.
7. **Relatório final** curto: o que foi implementado, desvios deste documento e porquê, resultados dos testes (incluindo o teste manual de zoom no iPhone), pendências.

---

## 20. Fora de âmbito / Fase 2

- Gerar o PDF da fatura dentro da app (no MVP o PDF é criado fora e anexado).
- Login com passkey / Face ID (WebAuthn) e MFA/OTP por e-mail.
- Notificações push (lembretes de pagamento, timesheet semanal).
- Leitura automática (OCR) de recibos.
- Importar timesheets de ficheiros da empresa.
- Múltiplas moedas com conversão nos relatórios (no MVP, relatórios por moeda).

---

## 21. Lições da versão anterior

A primeira versão (servidor Node/Fastify próprio) foi migrada à pressa para PocketBase e ficou inconsistente. Evitar:

1. **Ids**: a versão anterior guardava um `uid` do cliente num campo à parte e fazia `getFirstListItem('uid = "…"')` antes de cada update (lento e sujeito a duplicados). **Usar ids de 15 caracteres gerados no cliente como o próprio `id` do PocketBase.**
2. **Faturas como um blob JSON** (`fields`) impediam índices, regras e validação no servidor. **Usar campos reais e collection de linhas**.
3. **Totais confiados ao cliente**. **Recalcular no hook.**
4. **Verificação de e-mail foi saltada** no registo para "funcionar". **Manter verificação obrigatória.**
5. **Backup, destinos e sessões ficaram como stubs** depois da migração. **Implementar §4.10 completo com rotas próprias.**
6. **Campos com 13 px causavam zoom no iPhone** e o viewport não tinha `maximum-scale=1`. **Aplicar §6.**
7. **Collections criadas manualmente** no painel. **Tudo por migrações.**
8. Service worker com `skipWaiting` imediato pode recarregar a app a meio de uma edição. **Atualização controlada (§5.1 NF-04).**
