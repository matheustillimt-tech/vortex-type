# Vórtex Type

Formulários em formato de conversa: o lead responde uma pergunta por vez, como num chat, e cada resposta cai
na hora no seu painel.

## O que ele faz

- **Formulário em conversa**: bolhas de texto, "digitando…", uma pergunta por vez e barra de progresso. Abre no
  celular e dentro do navegador do Instagram e do TikTok.
- **Tipos de pergunta**: texto, WhatsApp (confere DDD e celular brasileiro), e-mail, escolha única (com busca
  quando a lista é grande), várias opções (com limite e opção "vale sozinha") e "Outro" com texto livre.
- **Perguntas condicionais**: uma pergunta só aparece se a pessoa respondeu algo específico antes.
- **Qualificação**: você marca quais respostas tiram a pessoa do perfil; ela recebe um fechamento diferente.
  A regra fica só no banco de dados, o lead não vê.
- **Respostas parciais**: quem abandona no meio aparece no painel com o que já preencheu.
- **Origem do lead**: guarda UTMs, ids de clique (Meta, Google, TikTok) e de onde a pessoa veio.
- **Pixels de anúncio**: Meta, TikTok e Google Ads, com o evento de lead disparado no fim.
- **Visual por formulário**: logo, foto do "atendente", cores, textos de fechamento, links de privacidade e
  termos, título da página e prévia do link.
- **Painel**: início com funil (onde as pessoas param), lista de respostas com filtros, botão do WhatsApp do
  lead e exportação em planilha (CSV), editor com prévia ao vivo, duplicar e desligar formulário.
- **Equipe**: Administrador (vê tudo) e Membro (só formulários e respostas). Cadastro fechado: só o
  Administrador cria acessos.
- **Sua marca**: nome do sistema, cor, logo e ícone da aba, trocados na tela de Configurações.
- **Webhooks**: avisa outro sistema (n8n, Make, seu CRM) quando alguém termina o formulário, com fila,
  5 tentativas e assinatura de segurança.
- **API REST** (`/api/v1`): consulta formulários, respostas e métricas com uma chave.
- **MCP** (`/api/mcp`): conecte no Claude Code e peça "cria um formulário", "quantas respostas tive essa
  semana?". Chaves só de leitura ou de leitura e escrita.
- **Domínio próprio por formulário** (opcional): `aplicacao.suaempresa.com.br` abre direto um formulário.
- **Limite de envios**: barra robôs e abusos na página pública.
- **Agendamento no fim** (opcional): quem termina com perfil escolhe um horário de reunião dentro da conversa,
  num sistema de agenda (Vórtex Call).

## Como funciona

1. Você monta o formulário no painel (perguntas, cores, textos) e vê a prévia ao lado.
2. Publica e compartilha o link (`seu-endereco/nome-do-formulario`), coloca no seu site ou num domínio próprio.
3. O lead responde no ritmo de um chat. Cada resposta é salva na hora, mesmo que ele pare no meio.
4. No fim, o sistema confere se ele tem perfil, dispara o pixel do anúncio, avisa seus outros sistemas pelo
   webhook e (se você ligar) mostra a agenda pra marcar a reunião.
5. Você acompanha tudo no painel: respostas, funil e planilha.

## Com o que é feito

- **Next.js 15 + React 19 + TypeScript**: o site e o painel.
- **Tailwind CSS 4**: o visual.
- **Supabase**: banco de dados (Postgres), login e armazenamento das imagens.
- **Vercel**: onde o sistema fica no ar, com a tarefa agendada (cron) que envia os webhooks.
- **Vitest**: testes automáticos.

## De quais contas você precisa

| Conta | Pra quê | Custo |
|---|---|---|
| GitHub | guardar o seu código e ligar na Vercel | grátis |
| Supabase | banco de dados, login e imagens | plano grátis serve pra começar (o projeto grátis pausa depois de 7 dias sem uso) |
| Vercel | deixar o sistema no ar | plano grátis (Hobby) serve pra testar; pra uso comercial e webhooks a cada minuto pela Vercel, plano Pro (pago) |
| Domínio próprio (opcional) | endereço com o nome da sua empresa | pago, no registrador que você usa |
| Vórtex Call (opcional) | agenda de reuniões no fim do formulário | depende de onde você instalar |
| Meta, TikTok, Google Ads (opcional) | pixels de anúncio | grátis pra criar o pixel |

## Instalar com o Claude Code

Abra o **Claude Code** (aba **Code** do app do Claude), escolha uma **pasta vazia** no seu computador e cole o
prompt abaixo. O Claude confere o que falta no seu computador, baixa o código e vai com você conta por conta.
Ele nunca pede pra você colar chave ou senha no chat.

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

O mesmo prompt está em [PROMPT-DE-INSTALACAO.md](PROMPT-DE-INSTALACAO.md).

## Instalar na mão

O passo a passo completo, com todas as variáveis e os problemas comuns, está no **[INSTALACAO.md](INSTALACAO.md)**.

## Estrutura de pastas

```
app/
  [slug]/              página pública de cada formulário (a conversa)
  _componentes/        conversa, cartão de agenda e visual do formulário
  (painel)/            painel: início, formulários, respostas, integrações, equipe, configurações
  api/v1/              API REST (leitura)
  api/mcp/             servidor MCP
  api/cron/webhooks/   envio da fila de webhooks
  login/               tela de entrada
src/lib/               regras do sistema (formulário, agendamento, webhooks, API, MCP, marca, acesso)
supabase/migrations/   banco de dados, em ordem
supabase/extras/       SQL opcional (webhooks a cada minuto pelo Supabase)
scripts/               criar o primeiro Administrador, conectar o MCP, agenda de mentira pra testes
tests/                 testes automáticos (e testes do banco em tests/sql)
```

## Licença

MIT. Pode usar, mudar e vender o que construir em cima. Veja o arquivo [LICENSE](LICENSE).

---

Feito pelo Grupo Vórtex · entregue na Plataforma Vórtex IA
