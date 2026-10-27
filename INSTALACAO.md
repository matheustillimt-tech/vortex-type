# Instalação do Vórtex Type (passo a passo)

Este guia instala o Vórtex Type nas **suas** contas, do zero. Leva de 40 minutos a 1 hora e meia na primeira
vez. Prefere que o Claude Code faça junto com você? Use o [PROMPT-DE-INSTALACAO.md](PROMPT-DE-INSTALACAO.md).

Alguns termos que aparecem aqui:

- **Variável de ambiente**: uma configuração (endereço, chave) que fica fora do código. No seu computador
  ela mora no arquivo `.env.local`; no ar, nas configurações do projeto na Vercel.
- **Migração**: um arquivo SQL que cria ou muda tabelas do banco. Ficam em `supabase/migrations/` e rodam em
  ordem.
- **RLS** (Row Level Security): regra do banco que decide quem pode ler e gravar cada linha.
- **Cron**: tarefa que roda sozinha de tempos em tempos (aqui, o envio dos webhooks).
- **Terminal**: a janela onde você digita comandos (no Mac, o app Terminal; no Windows, o PowerShell).

---

## 1. Contas

| Conta | Pra quê | Custo |
|---|---|---|
| [GitHub](https://github.com) | guardar o seu código e ligar na Vercel | grátis |
| [Supabase](https://supabase.com) | banco de dados, login e imagens | plano grátis serve pra começar. O projeto grátis pausa depois de 7 dias sem uso (é só reativar no painel) |
| [Vercel](https://vercel.com) | deixar o sistema no ar | plano grátis (Hobby) serve pra testar. Os termos da Vercel pedem o plano Pro (pago) pra uso comercial, e só o Pro roda cron a cada minuto |

Opcionais: um domínio próprio, o Vórtex Call (agenda) e as contas de anúncio (Meta, TikTok, Google) pros pixels.

No seu computador você precisa de:

- **Node.js 20 ou mais novo** ([nodejs.org](https://nodejs.org), versão LTS). Confira com `node -v`.
- **Git** ([git-scm.com](https://git-scm.com)). Confira com `git --version`.
- **CLI do Supabase** ([guia oficial](https://supabase.com/docs/guides/local-development/cli/getting-started)).
  No Mac: `brew install supabase/tap/supabase`. Confira com `supabase --version`.
- **CLI da Vercel** (opcional, ajuda a cadastrar variáveis): `npm i -g vercel`.

## 2. Baixar o código

```bash
git clone https://github.com/matheustillimt-tech/vortex-type.git
cd vortex-type
npm install
cp .env.example .env.local
```

O `.env.local` é onde ficam as suas chaves. Ele nunca vai pro GitHub (o `.gitignore` já ignora).

## 3. Supabase: criar o projeto e o banco

1. Em [supabase.com/dashboard](https://supabase.com/dashboard), crie um projeto novo. Região: **South America
   (São Paulo)**. Guarde a senha do banco num lugar seguro.
2. No terminal, dentro da pasta `vortex-type`:

   ```bash
   supabase login
   supabase link --project-ref SEU-REF
   supabase db push
   ```

   O `SEU-REF` é o **Reference ID** do projeto (Project Settings → General). O `supabase link` pede a senha do
   banco. O `supabase db push` cria todas as tabelas, regras de acesso e as pastas de imagens (`marca` e
   `formularios`).
3. **Feche o cadastro**: Authentication → Sign In / Providers → desligue **Allow new users to sign up**. Quem
   cria acesso é o Administrador, pela tela Equipe.
4. **Chaves**: em Project Settings → API Keys, abra a aba **Legacy API keys** e copie a `anon` e a
   `service_role` pro `.env.local`. Em Project Settings → Data API, copie a **URL** do projeto. (O sistema foi
   feito e testado com essas chaves. As chaves novas, `sb_publishable_…` e `sb_secret_…`, devem servir no lugar,
   mas não foram testadas.)

Este sistema não usa Edge Functions do Supabase: não precisa de `supabase functions deploy` nem de
`supabase secrets set`. O Supabase Vault (cofre de segredos) só entra se você escolher o envio de webhooks pelo
Supabase (passo 7).

## 4. Variáveis de ambiente

| Variável | Pra que serve | Onde pegar | Obrigatória? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | endereço do banco | Supabase → Project Settings → Data API | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública do banco (vai pro navegador; o banco protege os dados com RLS) | Supabase → Project Settings → API Keys → Legacy API keys → `anon` | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta do banco, só no servidor | Supabase → Project Settings → API Keys → Legacy API keys → `service_role` | sim |
| `NEXT_PUBLIC_SITE_URL` | endereço final do sistema, sem barra no fim. Usado nos links da API, do MCP, dos webhooks e pra ligar domínios próprios | o endereço da Vercel ou o seu domínio. No computador: `http://localhost:3000` | recomendada (sem ela, domínios próprios ficam desligados) |
| `CRON_SECRET` | senha que autoriza a rota que envia os webhooks | gere no terminal: `openssl rand -hex 24` | sim, pra enviar webhooks |
| `NEXT_PUBLIC_VORTEX_CALL_URL` | endereço do Vórtex Call (agenda no fim do formulário) | o endereço onde o seu Vórtex Call está no ar | não (vazia = aba Agendamento desligada) |
| `VERCEL_TOKEN` | deixa o sistema cadastrar domínios próprios na Vercel | [vercel.com/account/tokens](https://vercel.com/account/tokens) | não (as três de domínio vão juntas) |
| `VERCEL_PROJECT_ID` | id do projeto na Vercel | Vercel → projeto → Settings → General → Project ID | não |
| `VERCEL_TEAM_ID` | id do time na Vercel | Vercel → Team Settings → General → Team ID | não |

Variáveis que começam com `NEXT_PUBLIC_` entram no código do navegador na hora da publicação: se trocar
alguma, **publique de novo** na Vercel.

## 5. Testar no seu computador

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O seu computador usa o mesmo banco do Supabase que vai pro
ar, então o que você criar aqui já aparece lá.

**Primeiro Administrador.** O cadastro é fechado, então o primeiro acesso nasce por um script, rodado por
você no seu terminal (ele lê o `.env.local`):

```bash
npx tsx scripts/criar-admin.ts --email voce@suaempresa.com.br --nome "Seu Nome"
```

A senha aparece **uma vez**, só no seu terminal. Copie, entre no painel e troque em **Meu perfil** (canto de
cima). As próximas pessoas você cria pela tela **Equipe** (a senha delas também aparece uma vez só).

Crie um formulário (ele já nasce com um roteiro de exemplo), ligue e responda pelo link público numa janela
anônima. A resposta tem que aparecer em **Respostas**.

## 6. Publicar na Vercel

1. Coloque o código num repositório **seu** no GitHub. Jeito mais simples: no GitHub, abra
   `github.com/matheustillimt-tech/vortex-type` e clique em **Fork**. Se quiser um repositório privado, crie um
   repositório vazio na sua conta e envie o código pra ele:

   ```bash
   git remote rename origin original
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
   git push -u origin main
   ```

2. Na Vercel: **Add New → Project**, escolha o repositório e clique em **Deploy** (a primeira publicação pode
   falhar por falta de variáveis, tudo bem).
3. Em **Settings → Environment Variables**, cadastre as variáveis do passo 4 (ambiente **Production**). Marque
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` e `VERCEL_TOKEN` como **Sensitive**. Pela linha de comando:
   `vercel link` e depois `vercel env add NOME_DA_VARIAVEL production` (você digita o valor no terminal).
4. Em **Deployments**, clique nos três pontinhos da última publicação → **Redeploy**.
5. Volte no Supabase: Authentication → URL Configuration → **Site URL** = o endereço da Vercel (ou o seu
   domínio). Coloque o mesmo endereço em `NEXT_PUBLIC_SITE_URL` na Vercel e publique de novo.

Daqui pra frente, todo envio (`git push`) pra branch `main` do seu repositório publica sozinho.

**Endereço do painel com o seu domínio** (opcional): Vercel → projeto → Settings → Domains → adicione, por
exemplo, `formularios.suaempresa.com.br` e crie no seu DNS o registro que a Vercel mostrar (subdomínio:
`CNAME` apontando pra `cname.vercel-dns.com`; domínio raiz: `A` apontando pra `76.76.21.21`).

## 7. Webhooks: a tarefa que envia a fila (cron)

Quando alguém termina um formulário, o aviso pros webhooks entra numa fila. Quem esvazia a fila é a rota
`/api/cron/webhooks`, chamada de tempos em tempos com o `CRON_SECRET`.

O `vercel.json` vem com o cron **uma vez por dia** (`0 9 * * *`), porque o plano grátis da Vercel não aceita
cron mais frequente (a publicação falha). Pra os avisos saírem em até 1 minuto, escolha uma opção:

- **Opção A, plano Pro da Vercel**: no `vercel.json`, troque `"0 9 * * *"` por `"* * * * *"` e publique.
  A Vercel manda o `CRON_SECRET` sozinha.
- **Opção B, grátis, pelo Supabase**: abra `supabase/extras/webhooks-a-cada-minuto.sql`, troque os dois
  marcadores (`https://SEU-DOMINIO` e `SEU-CRON-SECRET`) e rode o arquivo inteiro no **SQL Editor** do
  Supabase. Ele guarda o endereço e o segredo no Supabase Vault e agenda a chamada a cada minuto (extensões
  `pg_cron` e `pg_net`). Pode deixar o cron diário da Vercel junto: a fila não envia nada duas vezes.

O botão **Testar** e o **Reenviar** da tela de webhooks enviam na hora, sem esperar o cron.

## 8. Integrações

### Webhooks (avisar outro sistema)

Em **Integrações → Webhooks**, cadastre o endereço (`https://…`, com nome de domínio; IP e rede interna são
recusados) e escolha os formulários. Cada resposta concluída (com ou sem perfil) gera um `POST` com JSON:

```json
{
  "evento": "resposta.concluida",
  "id": "uuid da resposta",
  "formulario": "aplicacao",
  "formularioNome": "Aplicação",
  "link": "https://seu-dominio/aplicacao",
  "status": "completo",
  "nome": "Ana Souza",
  "primeiroNome": "Ana",
  "whatsapp": "55DDNUMERO",
  "email": "ana@exemplo.com",
  "empresa": "Padaria da Ana",
  "respostas": [{ "slug": "nome", "q": "Qual é o seu nome?", "a": "Ana Souza", "papel": "nome" }],
  "criadoEm": "2026-01-01T12:00:00Z",
  "concluidoEm": "2026-01-01T12:03:00Z",
  "origem": { "utm_source": "instagram", "utm_medium": null, "utm_campaign": null, "utm_content": null, "utm_term": null }
}
```

`status` é `completo` (tem perfil) ou `desqualificado` (sem perfil). O teste do botão **Testar** vem com
`"teste": true`. Cabeçalhos: `X-Vortex-Type-Evento`, `X-Vortex-Type-Entrega` (número da entrega; pode repetir
numa nova tentativa) e `X-Vortex-Type-Assinatura: sha256=…`, o HMAC-SHA256 do corpo com o segredo do webhook
(mostrado na tela). Só resposta 2xx conta como entregue; o envio espera até 8 segundos e não segue
redirecionamento. Se falhar, tenta de novo depois de 1, 5, 30 e 120 minutos e desiste na 5ª falha.

### API REST e MCP

Em **Integrações → API e MCP**, crie uma chave (`vt_…`). Ela aparece uma vez só. Permissão **Leitura** só
consulta; **Leitura e escrita** também cria e edita formulários pelo MCP. Limite: 120 chamadas por minuto por
chave. A chave para de valer se quem criou deixar de ser Administrador.

API (todas `GET`, com o cabeçalho `Authorization: Bearer vt_…`):

```
/api/v1/formularios
/api/v1/formularios/{id}
/api/v1/formularios/{id}/metricas?de=AAAA-MM-DD&ate=AAAA-MM-DD
/api/v1/respostas?formulario={id}&status=completo&de=AAAA-MM-DD&ate=AAAA-MM-DD&limite=100&antes={proximo}
/api/v1/respostas/{id}
```

MCP no Claude Code: a tela mostra o comando pronto, no formato
`claude mcp add --transport http vortex-type https://seu-dominio/api/mcp --header "Authorization: Bearer vt_…"`.
Ferramentas: `listar_formularios`, `ver_formulario`, `criar_formulario`, `editar_formulario`,
`ligar_desligar_formulario`, `listar_respostas`, `ver_resposta`, `metricas_formulario`.

Atalho: `npx tsx scripts/conectar-mcp.ts --site https://seu-dominio --env .env.local` cria uma chave e já
conecta o MCP no Claude Code do seu computador, sem mostrar a chave.

### Domínio próprio por formulário

Com `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` e `NEXT_PUBLIC_SITE_URL` cadastradas (e publicado de
novo), a aba **Integrações → Domínios** liga. Escolha o formulário e o endereço (ex.:
`aplicacao.suaempresa.com.br`); a tela mostra o registro de DNS pra criar (subdomínio: `CNAME` →
`cname.vercel-dns.com`; domínio raiz: `A` → `76.76.21.21`). Depois clique em verificar. Nesse endereço só o
formulário abre; o painel continua no endereço principal.

### Agendamento no fim do formulário (Vórtex Call)

Quem termina com perfil pode escolher um horário de reunião dentro da conversa. Isso usa o **Vórtex Call**, o
sistema de agenda do Grupo Vórtex, instalado nas suas contas.

1. Cadastre `NEXT_PUBLIC_VORTEX_CALL_URL` com o endereço do seu Vórtex Call e publique de novo.
2. No editor do formulário, aba **Agendamento**: ligue, informe o endereço da agenda (a parte final do link da
   agenda no Call) e clique em **Testar**. Dá pra trocar todos os textos do cartão e colocar o WhatsApp do botão
   de confirmar presença.

Quer usar outro sistema de agenda? O navegador do lead fala direto com ele (precisa liberar CORS) por duas
chamadas:

- `GET {endereço}/api/agendamento/{agenda}` → `{ "sessoes": [{ "id": "…", "inicio": "data ISO", "restantes": 10, "lotada": false }] }`
- `POST {endereço}/api/agendamento/{agenda}/inscrever` com `{ "sessao", "nome", "whatsapp" (formato +55…), "email",
  "resposta", "respostas": [{ "pergunta", "resposta" }], "utm", "origem": "encaixe" }` → `200` com
  `{ "resultado": "nova" | "mesma" | "reagendada", "inicio": "data ISO", "link": "https://… (opcional)" }`;
  `409` quando o horário lotou.

Pra testar no computador sem agenda de verdade: `node scripts/call-falso.mjs` (sobe uma agenda de mentira na
porta 3999) e `NEXT_PUBLIC_VORTEX_CALL_URL=http://localhost:3999` no `.env.local`.

### Pixels de anúncio

No editor do formulário, aba **Pixels**: cole o id do pixel da Meta, do TikTok e/ou do Google (`G-…`, `AW-…`) e
escolha os eventos disparados quando a pessoa termina (padrão: `Lead` na Meta e `SubmitForm` no TikTok). Dá pra
escolher se quem fica sem perfil também conta como lead.

## 9. Personalizar

- **Marca do sistema** (nome, cor, logo, ícone da aba): tela **Configurações**. Fica no banco, não no código.
- **Cada formulário** (perguntas, cores, logo, foto, textos, links de privacidade e termos, título da página):
  editor do formulário, com prévia ao vivo.
- **Textos padrão** (os que valem quando o formulário não muda nada): `src/lib/formulario/padroes.ts` e
  `src/lib/agendamento/padroes.ts`.
- **Roteiro de exemplo** que nasce em todo formulário novo: `src/lib/formulario/exemplo.ts`.
- **Cores do painel**: `app/globals.css`. Visual da conversa: `app/_componentes/formulario.css`.

## 10. Checklist de teste

- [ ] Entrar no painel com o Administrador e trocar a senha em Meu perfil.
- [ ] Configurações: trocar nome, cor e logo; a tela de login mostra a sua marca.
- [ ] Criar um formulário, ligar e responder pelo link público numa janela anônima.
- [ ] A resposta aparece em **Respostas** (e uma resposta abandonada no meio aparece como "Abandonou").
- [ ] **Início** mostra o funil do formulário.
- [ ] Webhook: cadastrar um endereço de teste (por exemplo, de [webhook.site](https://webhook.site)), clicar em
      **Testar** e ver o aviso chegar; responder o formulário e ver o aviso chegar pelo cron.
- [ ] API: chamar `https://seu-dominio/api/v1/formularios` com a sua chave no cabeçalho `Authorization`
      (o Claude Code faz isso pra você) devolve a lista de formulários.
- [ ] Equipe: criar um Membro e conferir que ele não vê Integrações, Equipe nem Configurações.
- [ ] Apagar o formulário, as respostas e o webhook de teste.

## 11. Problemas comuns

- **"Variável de ambiente ausente: …"**: falta essa variável no `.env.local` (computador) ou na Vercel (no ar).
  Na Vercel, depois de cadastrar, publique de novo.
- **A publicação falha com "Hobby accounts are limited to daily cron jobs"**: o `vercel.json` está com cron
  mais frequente que diário num plano grátis. Volte pra `"0 9 * * *"` e use a opção B do passo 7.
- **Webhooks não chegam**: confira o histórico de entregas na tela de webhooks. Se nada sai, o cron não está
  rodando: confira o `CRON_SECRET` (o mesmo na Vercel e no Vault, se usar a opção B) e o passo 7. Use
  **Reenviar** pra mandar de novo.
- **Entrei e aparece "sem acesso"**: a pessoa existe no login mas não está na equipe. Crie pela tela Equipe ou
  rode o `scripts/criar-admin.ts` com o e-mail dela.
- **Aba Domínios ou Agendamento desligada**: faltam as variáveis da integração (passo 4) ou falta publicar de
  novo depois de cadastrar.
- **O sistema parou de responder do nada (plano grátis do Supabase)**: o projeto foi pausado por falta de uso.
  Reative no painel do Supabase.
- **Erro `TenantNotFound` ao subir imagem num projeto novo do Supabase**: reinicie o projeto (Project Settings
  → General → Restart project) e rode `supabase db push` de novo.
- **Logo ou favicon não sobe**: o limite é 1 MB (PNG, JPG, SVG, WebP ou ICO). Imagens dos formulários: até 2 MB.
- **"muitos envios, tente de novo em instantes"**: é o limite da página pública (20 envios por minuto por
  endereço de internet e 3000 por minuto por formulário). Some sozinho em um minuto.
- **Script chamando o seu domínio recebe 403**: se o domínio passa pelo Cloudflare, ele pode bloquear robôs
  sem identificação. Mande um cabeçalho `User-Agent` próprio no script.
