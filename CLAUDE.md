# CLAUDE.md — Vórtex Type

Guia pro Claude Code mexer neste template. Quem usa normalmente é dono de negócio, não programador: explique
em português simples, mostre o que vai mudar antes de mudar e nunca peça chave ou senha no chat.

## O que é

Formulários em formato de conversa (uma pergunta por vez), com página pública, painel de respostas e funil,
equipe (Administrador e Membro), marca configurável, webhooks com fila e tentativas, API REST de leitura
(`/api/v1`), servidor MCP (`/api/mcp`), domínio próprio por formulário (via API da Vercel, opcional), limite
de envios na página pública e, opcional, agendamento de reunião no fim do formulário num sistema de agenda
(Vórtex Call). Cada instalação é uma cópia própria: um projeto Supabase e um projeto Vercel.

Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Supabase (`@supabase/ssr`), Vitest.

## Onde está cada coisa

- `app/[slug]/page.tsx`: página pública do formulário. A conversa está em `app/_componentes/conversa.tsx`
  (classe `Motor`), o cartão de agenda em `app/_componentes/agenda.tsx` e o visual em `formulario.css`.
- `app/(painel)/`: painel (`/`, `/formularios`, `/respostas`, `/integracoes`, `/equipe`, `/configuracoes`).
  Qualquer outro caminho é público (formulário). Slug novo passa por `slugReservado()` em `src/lib/regras/rotas.ts`.
- `app/api/v1/**`: API REST (só leitura). `app/api/mcp` + `src/lib/mcp/`: MCP (Streamable HTTP sem estado).
  `app/api/cron/webhooks`: esvazia a fila de webhooks (pede `Authorization: Bearer $CRON_SECRET`).
- `src/lib/formulario/`: regras da conversa (`fluxo.ts`), textos e cores padrão (`padroes.ts`), roteiro de
  exemplo (`exemplo.ts`), pixels, métricas e o acesso da página pública ao banco (`api.ts`).
- `src/lib/agendamento/`: integração com a agenda (`call.ts`), datas em horário de Brasília e textos padrão.
- `src/lib/webhooks/`: fila, envio (`entregar.ts`), assinatura HMAC e regras de URL (`regras.ts`).
- `src/lib/regras/`: regras puras (acesso, marca, menu, rotas, domínio), cada uma com teste em `tests/`.
- `middleware.ts`: login do painel e roteamento de domínio próprio.
- `supabase/migrations/`: banco, em ordem. `supabase/extras/`: SQL opcional, rodado à mão (não é migração).
- `scripts/criar-admin.ts` (primeiro Administrador), `scripts/conectar-mcp.ts` (chave + MCP no Claude Code),
  `scripts/call-falso.mjs` (agenda de mentira na porta 3999 pra testar o agendamento).
- Instalação completa: `INSTALACAO.md`. Variáveis: `.env.example`.

## Como rodar

```bash
npm install
cp .env.example .env.local   # a pessoa preenche; nunca peça os valores no chat
npm run dev                  # http://localhost:3000
npm test                     # testes (não precisam de banco nem internet)
npm run typecheck
npm run build
```

Testes do banco (`tests/sql/*.sql`) precisam de um Supabase local (`supabase start`, com Docker) e rodam com
`psql`; cada um abre uma transação e desfaz tudo no fim.

## Personalizar marca e textos

- Nome, cor, logo e ícone da aba do sistema: tela **Configurações** (tabela `configuracao`), não no código.
  O nome padrão "Vórtex Type" e a cor padrão estão em `src/lib/regras/marca.ts` e na migração
  `20261022120100_configuracao.sql`.
- Textos padrão do formulário: `src/lib/formulario/padroes.ts`. Do cartão de agenda: `src/lib/agendamento/padroes.ts`.
  Cada formulário pode trocar os seus no editor.
- Cores do painel: `app/globals.css` (tokens `--color-vt-*`). Visual da conversa: `app/_componentes/formulario.css`.
- Texto do banner do login: `app/login/banner.tsx`.

## Regras

- Nunca versionar `.env`, `.env.local` nem nada com chave. Nunca imprimir chave no terminal ou no chat.
- Migração nova sempre no **fim da fila**: arquivo novo em `supabase/migrations/` com data/hora maior que a
  última. Nunca editar uma migração que já rodou num banco de verdade. Aplicar com `supabase db push` (mostre
  antes o que vai mudar e espere o OK).
- Tabela nova: ligar RLS e dar acesso pelas funções `eh_membro()` / `eh_admin()`. A página pública só fala com
  o banco por funções `security definer` liberadas pro `anon`.
- Variável `NEXT_PUBLIC_*` vai pro navegador e só vale depois de publicar de novo.
- Se o repositório estiver ligado na Vercel, **push na `main` publica**. Trabalhe numa branch e só junte na
  `main` com o OK da pessoa.
- Regra nova em `src/lib/` vem com teste em `tests/`. Rode `npm test`, `npm run typecheck` e `npm run build`
  antes de dizer que terminou.
- O cron do `vercel.json` é diário porque o plano grátis da Vercel não aceita mais frequente. Pra entregar a
  cada minuto: plano Pro (`"* * * * *"`) ou `supabase/extras/webhooks-a-cada-minuto.sql`.
