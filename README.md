# Calendário de Séries

App pessoal, rápido e responsivo para acompanhar o calendário mensal público do PogDesign.

## Como rodar

```bash
npm install
npm run dev
```

Depois abra o endereço mostrado pelo Vite, normalmente `http://127.0.0.1:5173`.

## Scripts

```bash
npm run dev        # servidor local com /api/calendar
npm run build      # typecheck + build de produção
npm run test       # testes unitários
npm run typecheck  # valida frontend, server e api
```

## Fonte de dados

O calendário mensal usa as páginas públicas do PogDesign:

- `https://www.pogdesign.co.uk/cat/:month-:year`

A rota `/api/calendar?year=:year&month=:month` busca uma página mensal, extrai os episódios renderizados no HTML e entrega ao frontend uma lista normalizada. Isso mantém o app alinhado ao que aparece no PogDesign, sem buscar séries extras de catálogos globais.

## Vercel

O backend fica no próprio projeto em `api/calendar.ts`, como função serverless da Vercel. Não é necessário hospedar um backend separado.

As rotas `/api/show`, `/api/episode` e `/api/notifications` também são funções do mesmo projeto.

`vercel.json` mantém `/api/*` apontando para as funções e redireciona as demais rotas para o SPA, preservando URLs como `/calendar/2026/07`.

## Acompanhamento e notificações

Nos detalhes de uma série, **Acompanhar série** salva o acompanhamento. O sininho no cabeçalho mostra a quantidade de notificações não lidas, abre os últimos lançamentos e oferece acesso à central em `/notifications`. A central reúne todo o histórico desde o início do acompanhamento, permite buscar séries/episódios, filtrar não lidas, marcar todas como lidas e deixar de acompanhar uma série.

O backend consulta o catálogo do [TVmaze](https://www.tvmaze.com/api) e gera uma notificação para cada episódio com horário exato de lançamento posterior ao início do acompanhamento. Episódios antigos, futuros ou sem horário confirmado não geram notificações antecipadas. O feed é recalculado ao acessar o site, ao voltar à janela e a cada minuto enquanto a janela está ativa. Lançamentos que aconteceram enquanto o site estava fechado aparecem no próximo acesso.

Uma notificação abre `/episode/:episodeId?notification=:showId%3A:episodeId`, marca somente aquele episódio como lido e exibe o acompanhamento, informações da série, data/hora em `America/Sao_Paulo` (Brasília), um contador em dias/horas/minutos/segundos e atalhos para as duas abas da central. O contador atualiza a cada segundo e pode contar até um lançamento futuro se a data do episódio for alterada na fonte.

### Persistência sem outra hospedagem

O estado de acompanhamento e leitura fica em um cookie persistente, compactado e criptografado com AES-256-GCM pelo servidor. Ele usa `HttpOnly`, `SameSite=Strict`, `Secure` em produção e validade de um ano desde a última alteração. Cada navegador tem seu próprio acompanhamento, sem conta ou sincronização entre dispositivos. Limpar os cookies remove o acompanhamento.

Não há banco de dados, arquivo gravado no disco temporário da função ou sessão dependente da memória do servidor. O cookie carrega os IDs das séries, as datas de início e o estado de leitura; os episódios e metadados são reconstruídos no servidor a partir do catálogo. Assim, reinícios e novas instâncias da Vercel preservam o estado, desde que a chave de criptografia permaneça igual. O cache em memória de cinco minutos acelera consultas públicas, mas não é necessário para persistência.

É possível acompanhar até 30 séries por navegador para respeitar o limite de tamanho dos cookies. Leituras consecutivas são compactadas por data; se muitas leituras isoladas ocuparem todo o cookie, a API preserva o estado anterior e orienta a marcar todas como lidas. A central não limita o histórico gerado: o botão **Mostrar mais** pagina a lista na interface.

### Configuração na Vercel

Antes do primeiro deploy com notificações, adicione uma chave privada e estável ao projeto:

1. Gere 32 bytes aleatórios com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
2. Em **Settings → Environment Variables**, salve o resultado em `NOTIFICATIONS_SECRET`, tipo **Secret**, no ambiente **Production**.
3. Faça um novo deploy; pushes para a `main` disparam o deploy de produção do projeto.

A chave deve ter pelo menos 32 caracteres e permanecer no servidor. Não use prefixo `VITE_`, não coloque o valor no Git e não troque a chave em novos deploys: uma troca invalida os cookies existentes. Para usar a funcionalidade em previews, configure uma chave própria nesse ambiente. Sem a variável, a API retorna `503` com uma mensagem de configuração; o calendário continua funcionando.

No desenvolvimento local, `npm run dev` usa uma chave fixa exclusiva de desenvolvimento. Para substituí-la, copie `.env.example` para `.env.local` e preencha `NOTIFICATIONS_SECRET`. Arquivos `.env` são ignorados pelo Git.

### API de notificações

Todas as respostas são privadas e usam `Cache-Control: no-store`; alterações exigem JSON e recusam requisições de origem diferente.

| Método | Rota | Corpo | Resultado |
| --- | --- | --- | --- |
| GET | `/api/notifications` | — | Séries acompanhadas, notificações, contagem não lida e falhas parciais |
| POST | `/api/notifications` | `{ "action": "follow", "showId": 1 }` | Acompanha uma série; chamadas repetidas preservam a data original |
| DELETE | `/api/notifications` | `{ "action": "unfollow", "showId": 1 }` | Remove a série do acompanhamento |
| PATCH | `/api/notifications` | `{ "action": "read", "notificationId": "1:123" }` | Marca apenas uma notificação como lida |
| PATCH | `/api/notifications` | `{ "action": "readAll", "through": "2026-10-05T20:00:00.000Z" }` | Marca como lidas as notificações até a data do feed exibido |

O cliente serializa operações de cookie com Web Locks e avisa outras abas com BroadcastChannel. Falhas de consulta de uma série não removem seu acompanhamento; resumos já carregados permanecem visíveis enquanto a fonte é atualizada. Não é necessário configurar cron, outro provedor ou serviço de notificações. A funcionalidade é uma central dentro do site.

Os horários seguem o lançamento informado pelo catálogo, convertido para Brasília. O próprio [TVmaze informa cache de até uma hora](https://www.tvmaze.com/api#caching) para alterações de metadados; a geração de uma notificação de episódio já conhecido ocorre quando seu horário chega.

## Performance

- O frontend faz uma única chamada por mês.
- O servidor mantém cache em memória por mês.
- A resposta HTTP usa `s-maxage` e `stale-while-revalidate` para aproveitar cache da Vercel.
- O calendário não faz chamadas extras por série ao renderizar a visão mensal.

## Estrutura

```text
api/
  calendar.ts       função serverless da Vercel
  notifications.ts  backend de acompanhamento e notificações
server/
  calendarApi.ts    parser/cache/handler compartilhado com o Vite local
  notificationsApi.ts geração do feed e ações de acompanhamento/leitura
  notificationState.ts persistência criptografada em cookie
  notificationCatalog.ts cache público das séries acompanhadas
src/
  components/       componentes reutilizáveis
  config/           timezone, fonte e metadados de filtros
  hooks/            hooks de dados
  lib/              datas, filtros e classificação
  pages/            calendário, série, episódio e central de notificações
  services/         cliente de dados do app
  state/            store global de filtros
  styles/           CSS global
  types/            tipos internos
```
