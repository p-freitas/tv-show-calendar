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

`vercel.json` mantém `/api/*` apontando para as funções e redireciona as demais rotas para o SPA, preservando URLs como `/calendar/2026/07`.

## Performance

- O frontend faz uma única chamada por mês.
- O servidor mantém cache em memória por mês.
- A resposta HTTP usa `s-maxage` e `stale-while-revalidate` para aproveitar cache da Vercel.
- O calendário não faz chamadas extras por série ao renderizar a visão mensal.

## Estrutura

```text
api/
  calendar.ts       função serverless da Vercel
server/
  calendarApi.ts    parser/cache/handler compartilhado com o Vite local
src/
  components/       componentes reutilizáveis
  config/           timezone, fonte e metadados de filtros
  hooks/            hooks de dados
  lib/              datas, filtros e classificação
  pages/            calendário, série e episódio
  services/         cliente de dados do app
  state/            store global de filtros
  styles/           CSS global
  types/            tipos internos
```
