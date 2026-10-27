# Prompt de instalação do Vórtex Type

Abra o **Claude Code** (aba **Code** do app do Claude), escolha uma **pasta vazia** no seu computador e cole o
texto abaixo inteiro. O Claude vai instalar tudo junto com você, um passo de cada vez.

```text
Quero instalar o Vórtex Type (formulários em conversa, com painel, webhooks, API e MCP) nas minhas próprias
contas. O código é aberto: https://github.com/matheustillimt-tech/vortex-type
Eu não sou programador: explique cada passo em português simples, um de cada vez, e espere eu responder
antes de seguir.

REGRAS (siga sempre):
- Nunca me peça pra colar chave, token ou senha aqui no chat. Quando precisar de uma chave, abra o arquivo
  .env.local pra mim (no editor) e eu colo lá; ou rode `vercel env add` / `supabase secrets set` no
  terminal pra eu digitar o valor direto. Se eu colar uma chave no chat por engano, me avise pra eu gerar
  outra.
- Nunca versione (git add/commit) o .env.local nem qualquer arquivo .env com valores.
- Antes de qualquer comando que cria, apaga ou publica algo nas minhas contas, me diga o que vai fazer e
  espere o meu OK.
- Se algo der erro, me explique o que aconteceu antes de tentar outra coisa.

PASSO 1 — Conferir o computador
Confira se tenho Node.js 20 ou mais novo, Git, a CLI do Supabase e a CLI da Vercel (`node -v`, `git --version`,
`supabase --version`, `vercel --version`). O que faltar, me diga como instalar no meu sistema (Mac: Homebrew;
Windows: instalador oficial ou npm) e instale comigo. A CLI da Vercel pode ser `npm i -g vercel`.

PASSO 2 — Baixar o código
Rode `git clone https://github.com/matheustillimt-tech/vortex-type.git` nesta pasta, entre em `vortex-type`,
rode `npm install` e copie `.env.example` pra `.env.local`. Leia o README.md, o INSTALACAO.md e o CLAUDE.md
do projeto: o INSTALACAO.md é o roteiro completo que vamos seguir.

PASSO 3 — Contas (uma de cada vez, esperando eu terminar cada uma)
a) GitHub: confira se tenho conta (é grátis). Vou precisar dela pra publicar na Vercel.
b) Supabase (banco de dados, login e arquivos; plano grátis serve): me guie pra criar a conta e um projeto
   novo, região São Paulo (South America). Me peça pra guardar a senha do banco num lugar seguro (não no chat).
c) Vercel (onde o sistema fica no ar; plano grátis serve pra testar): me guie pra criar a conta entrando com
   o GitHub.

PASSO 4 — Banco de dados
Rode `supabase login` (abre o navegador) e `supabase link --project-ref <ref>`; me mostre onde achar o
"Reference ID" do projeto (Project Settings → General). Rode `supabase db push` pra criar as tabelas.
Depois me guie no painel do Supabase:
- Authentication → Sign In / Providers: desligar "Allow new users to sign up" (o cadastro é fechado; quem
  cria acesso é o Administrador).
- Project Settings → API Keys → aba "Legacy API keys": abra o .env.local pra mim e eu colo a anon e a
  service_role. Project Settings → Data API: eu colo a URL do projeto em NEXT_PUBLIC_SUPABASE_URL.
- Gere o CRON_SECRET no terminal com `openssl rand -hex 24` e grave direto no .env.local, sem mostrar no chat.

PASSO 5 — Testar no computador
Rode `npm run dev` e crie o primeiro Administrador com
`npx tsx scripts/criar-admin.ts --email <meu e-mail> --nome "<meu nome>"`. A senha aparece só no meu
terminal: me peça pra copiar e guardar. Me peça pra abrir http://localhost:3000, entrar e criar um formulário
de teste.

PASSO 6 — Publicar na Vercel
Me ajude a subir o código pra um repositório MEU no GitHub (privado, se eu preferir) e a importar esse
repositório na Vercel (Add New → Project). Cadastre as variáveis do .env.local na Vercel com `vercel env add`
(eu digito cada valor no terminal), em Production. NEXT_PUBLIC_SITE_URL é o endereço que a Vercel der (ou o
meu domínio). Publique, e depois volte no Supabase (Authentication → URL Configuration) e coloque esse
endereço em "Site URL".

PASSO 7 — Webhooks a cada minuto
O vercel.json roda a fila de webhooks uma vez por dia (é o que o plano grátis da Vercel permite). Me explique
as duas opções do INSTALACAO.md (plano Pro da Vercel, ou o agendamento grátis do Supabase em
supabase/extras/webhooks-a-cada-minuto.sql) e faça a que eu escolher. Se for o SQL, eu mesmo troco os
marcadores e rodo no SQL Editor do Supabase.

PASSO 8 — Integrações (pergunte quais eu quero; todas são opcionais)
- Domínio próprio por formulário (VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID).
- Agendamento no fim do formulário (NEXT_PUBLIC_VORTEX_CALL_URL, endereço do meu Vórtex Call).
- Pixels de anúncio (Meta, TikTok, Google) no editor do formulário.
- MCP no Claude Code: criar uma chave em Integrações → API e MCP e rodar o comando que a tela mostra.

PASSO 9 — Checklist final
Siga o checklist do INSTALACAO.md comigo, item por item: login, formulário respondido pela página pública
aparecendo em Respostas, webhook de teste chegando, API respondendo. No fim, me dê um resumo do que ficou
pronto, os endereços e o que ainda falta.
```

Prefere fazer na mão? Siga o [INSTALACAO.md](INSTALACAO.md).
