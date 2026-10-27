"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { evento, salvarResposta, type Origem } from "@/src/lib/formulario/api";
import { alternarOpcao, htmlDaBolha, juntar, listaRespostas, mascaraTelefone, normalizarTelefone, porPapel, primeiroNome, progresso, proxima, separar, validar, type Respostas } from "@/src/lib/formulario/fluxo";
import { deveDispararLead, mesclar } from "@/src/lib/formulario/padroes";
import { disparar, iniciarPixels } from "@/src/lib/formulario/pixels";
import type { FormularioPublico, Pergunta, Textos } from "@/src/lib/formulario/tipos";
import { uuid } from "@/src/lib/formulario/uuid";
import { buscarHorarios, inscrever, linkWhatsapp, montarInscricao, urlCall } from "@/src/lib/agendamento/call";
import { horariosDePrevia } from "@/src/lib/agendamento/horarios";
import { mesclarAgendamento } from "@/src/lib/agendamento/padroes";
import type { AgendamentoEfetivo, ResultadoInscricao, SessaoCall } from "@/src/lib/agendamento/tipos";
import { Agenda } from "./agenda";
import { IconeWhatsApp } from "./icone-whatsapp";
import "./formulario.css";

/** Ritmo da conversa, em ms. */
const RITMO = { digitando: 700, entreBolhas: 250, aposPergunta: 150, aposResposta: 220, entreFechamentos: 280 };

type Msg = { id: number; de: "bot" | "lead" | "digitando"; html?: string; texto?: string; pergunta?: boolean };
type Entrada = { tipo: "escolha" | "varias" | "texto" | "livre"; p: Pergunta } | null;
type Fase = "respondendo" | "enviando" | "falhou" | "fim";

type Estado = { mensagens: Msg[]; entrada: Entrada; erro: string; idx: number; respostas: Respostas; fase: Fase; agenda: SessaoCall[] | null };


function lerSessao(k: string) {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
function gravarSessao(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v);
  } catch {}
}

function cookie(nome: string) {
  const m = document.cookie.match(new RegExp(`(?:^|;)\\s*${nome}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/** UTMs e ids de clique da URL (guardados na sessão: se a pessoa recarregar sem eles, continuam valendo). */
function lerOrigem(): Origem {
  const salvo = (() => {
    try {
      return JSON.parse(lerSessao("tv_origem") || "{}") as Origem;
    } catch {
      return {};
    }
  })();
  const q = new URLSearchParams(window.location.search);
  const o: Origem = { ...salvo };
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "gbraid", "wbraid", "ttclid"]) {
    const v = q.get(k);
    if (v) o[k] = v.slice(0, 500);
  }
  gravarSessao("tv_origem", JSON.stringify(o));
  const fbp = cookie("_fbp");
  const fbc = cookie("_fbc");
  const ttp = cookie("_ttp");
  return {
    ...o,
    ...(fbp && { fbp }),
    ...(fbc && { fbc }),
    ...(ttp && { ttp }),
    url: window.location.href.slice(0, 1000),
    ...(document.referrer && { referrer: document.referrer.slice(0, 500) }),
  };
}

class Motor {
  estado: Estado = { mensagens: [], entrada: null, erro: "", idx: 0, respostas: {}, fase: "respondendo", agenda: null };
  private n = 0;
  private iniciou = false;
  private salvando = false;
  private salvarDeNovo = false;
  readonly respostaId = uuid();
  readonly anon: string;
  private origem: Origem = {};

  constructor(
    private bot: FormularioPublico,
    private textos: Textos,
    private cfgAgenda: AgendamentoEfetivo | null,
    private previa: boolean,
    private aoMudar: (e: Estado) => void,
    private aoConcluir: (eventId: string, desqualificado: boolean) => void,
  ) {
    let a = lerSessao("tv_anon");
    if (!a) {
      a = uuid();
      gravarSessao("tv_anon", a);
    }
    this.anon = a;
  }

  private ev(nome: string, meta: Record<string, unknown> = {}, resposta: string | null = null) {
    if (!this.previa) evento(this.bot.slug, this.anon, nome, resposta, meta);
  }

  async iniciar() {
    if (this.iniciou) return;
    this.iniciou = true;
    if (!this.previa) this.origem = lerOrigem();
    this.ev("abriu");
    this.mudar({ idx: proxima(this.bot.perguntas, {}, 0) });
    await this.mostrarPergunta();
  }

  async responder(valor: string) {
    const ent = this.estado.entrada;
    if (!ent) return;
    const p = ent.p;
    const v = valor.trim();
    const erro = ent.tipo === "escolha" || ent.tipo === "varias" ? (v ? null : "Escolha pelo menos uma opção.") : validar(p, v, ent.tipo === "livre");
    if (erro) return this.mudar({ erro });
    if (ent.tipo === "escolha" && p.outro && v === p.opcoes?.[p.opcoes.length - 1]) {
      return this.mudar({ entrada: { tipo: "livre", p }, erro: "" });
    }
    const guardado = p.tipo === "telefone" ? normalizarTelefone(v) : v;
    const respostas = { ...this.estado.respostas, [p.slug]: guardado };
    if (this.estado.idx === proxima(this.bot.perguntas, {}, 0)) this.ev("comecou");
    this.ev("respondeu", { pergunta: p.slug, ordem: this.estado.idx });
    this.mudar({ respostas, entrada: null, erro: "" });
    this.adicionar({ de: "lead", texto: p.tipo === "telefone" ? mascaraTelefone(v) : ent.tipo === "varias" ? separar(v).join(" · ") : v });
    void this.salvarParcial();
    const idx = proxima(this.bot.perguntas, respostas, this.estado.idx + 1);
    this.mudar({ idx });
    await this.esperar(RITMO.aposResposta);
    if (idx >= this.bot.perguntas.length) return this.terminar();
    await this.mostrarPergunta();
  }

  private async mostrarPergunta() {
    const p = this.bot.perguntas[this.estado.idx];
    if (!p) return;
    for (const b of p.bolhas ?? []) {
      if (!b.trim()) continue;
      await this.digitando();
      this.falar(b);
      await this.esperar(RITMO.entreBolhas);
    }
    await this.digitando();
    this.falar(p.texto, true);
    await this.esperar(RITMO.aposPergunta);
    this.mudar({ entrada: { tipo: p.tipo === "escolha" || p.tipo === "varias" ? p.tipo : "texto", p }, erro: "" });
  }

  private corpo(final: boolean) {
    const { perguntas } = this.bot;
    const r = this.estado.respostas;
    return {
      nome: porPapel(perguntas, r, "nome"),
      whatsapp: porPapel(perguntas, r, "whatsapp"),
      email: porPapel(perguntas, r, "email"),
      empresa: porPapel(perguntas, r, "empresa"),
      respostas: listaRespostas(perguntas, r),
      final,
      origem: this.origem,
    };
  }

  /**
   * Grava o lead parcial desde a primeira resposta e atualiza a cada pergunta: quem abandonar no meio aparece no
   * painel com tudo o que preencheu. Uma gravação por vez (a próxima leva as respostas mais novas). Só a primeira
   * conta no limite de envios; parcial não dispara webhook (só a conclusão).
   */
  private async salvarParcial() {
    if (this.previa) return;
    if (this.salvando) {
      this.salvarDeNovo = true;
      return;
    }
    this.salvando = true;
    try {
      do {
        this.salvarDeNovo = false;
        try {
          await salvarResposta(this.bot.slug, this.respostaId, this.corpo(false));
        } catch {}
      } while (this.salvarDeNovo);
    } finally {
      this.salvando = false;
    }
  }

  async terminar() {
    this.mudar({ fase: "enviando" });
    let desqualificado = false;
    if (!this.previa) {
      try {
        const r = await salvarResposta(this.bot.slug, this.respostaId, this.corpo(true));
        desqualificado = r.desqualificado;
      } catch {
        this.mudar({ fase: "falhou" });
        return;
      }
    }
    const eventId = uuid();
    if (!this.previa) this.aoConcluir(eventId, desqualificado);

    if (desqualificado) {
      this.ev("desqualificado", {}, this.respostaId);
      await this.digitando();
      this.falar(this.textos.desqualificado);
      this.mudar({ fase: "fim" });
      return;
    }
    this.ev("concluiu", {}, this.respostaId);
    // com agendamento, os horários já vêm sendo buscados enquanto o bot fala as últimas bolhas
    const carga = this.cfgAgenda ? this.recarregarHorarios().catch(() => [] as SessaoCall[]) : null;
    for (const t of this.textos.perfilIdeal) {
      await this.digitando();
      this.falar(t);
      await this.esperar(RITMO.entreFechamentos);
    }
    if (!this.cfgAgenda || !carga) {
      await this.digitando();
      this.falar(this.textos.fechamento);
      this.mudar({ fase: "fim" });
      return;
    }
    await this.digitando();
    this.falar(this.cfgAgenda.textos.chamada);
    const sessoes = await carga;
    await this.esperar(RITMO.entreFechamentos);
    if (!sessoes.length) {
      await this.digitando();
      this.falar(this.cfgAgenda.textos.semHorarios);
      this.mudar({ fase: "fim" });
      return;
    }
    this.ev("abriu_agenda", { horarios: sessoes.length }, this.respostaId);
    this.mudar({ agenda: sessoes, fase: "fim" });
  }

  /** Horários abertos (prévia: de mentira, sem chamar o Call). Lança se o Call falhar. */
  recarregarHorarios(): Promise<SessaoCall[]> {
    const a = this.cfgAgenda;
    if (!a) return Promise.resolve([]);
    if (this.previa) return Promise.resolve(horariosDePrevia(new Date()));
    return buscarHorarios(a.base, a.agenda);
  }

  /** Inscreve a pessoa no horário (prévia: finge que deu certo, com link de exemplo). */
  async agendar(s: SessaoCall): Promise<ResultadoInscricao> {
    const a = this.cfgAgenda;
    if (!a) return { tipo: "falhou" };
    let r: ResultadoInscricao;
    if (this.previa) {
      await this.esperar(600);
      r = { tipo: "nova", inicio: s.inicio, link: `${a.base}/c/exemplo` };
    } else {
      const pedido = montarInscricao({ perguntas: this.bot.perguntas, respostas: this.estado.respostas, respostaId: this.respostaId, sessao: s.id, origem: this.origem });
      r = pedido ? await inscrever(a.base, a.agenda, pedido) : { tipo: "falhou" };
    }
    if (r.tipo === "nova" || r.tipo === "mesma" || r.tipo === "reagendada") this.ev("agendou", { resultado: r.tipo }, this.respostaId);
    return r;
  }

  private mudar(p: Partial<Estado>) {
    this.estado = { ...this.estado, ...p };
    this.aoMudar(this.estado);
  }

  private adicionar(m: Omit<Msg, "id">) {
    const id = ++this.n;
    this.mudar({ mensagens: [...this.estado.mensagens, { ...m, id }] });
    return id;
  }

  private falar(texto: string, pergunta = false) {
    this.adicionar({ de: "bot", html: htmlDaBolha(texto, primeiroNome(this.bot.perguntas, this.estado.respostas)), pergunta });
  }

  private async digitando() {
    const id = this.adicionar({ de: "digitando" });
    await this.esperar(RITMO.digitando);
    this.mudar({ mensagens: this.estado.mensagens.filter((m) => m.id !== id) });
  }

  private esperar(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Mais de 8 opções vira busca. */
function Opcoes({ opcoes, onEscolher }: { opcoes: string[]; onEscolher: (o: string) => void }) {
  const [busca, setBusca] = useState("");
  const [marcado, setMarcado] = useState(-1);
  const achados = useMemo(() => {
    const t = semAcento(busca.trim());
    return t ? opcoes.filter((o) => semAcento(o).includes(t)) : opcoes;
  }, [opcoes, busca]);

  if (opcoes.length <= 8) {
    return (
      <div className="tv-row tv-inputrow">
        <div className="tv-ibox">
          <div className="tv-options">
            {opcoes.map((o) => (
              <button key={o} type="button" className="tv-opt" onClick={() => onEscolher(o)}>
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function tecla(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!achados.length) return;
      const d = e.key === "ArrowDown" ? 1 : -1;
      setMarcado((m) => (m < 0 ? (d > 0 ? 0 : achados.length - 1) : (m + d + achados.length) % achados.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = marcado >= 0 ? achados[marcado] : achados.length === 1 ? achados[0] : null;
      if (o) onEscolher(o);
    }
  }

  return (
    <div className="tv-row tv-inputrow">
      <div className="tv-ibox">
        <div className="tv-field">
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-label="Busque e escolha uma opção"
            placeholder="Digite para buscar..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setMarcado(-1);
            }}
            onKeyDown={tecla}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <ul className="tv-busca-lista" role="listbox" aria-label="Opções">
          {achados.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={i === marcado}
              className={`tv-achado${i === marcado ? " marcado" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onEscolher(o);
              }}
            >
              {o}
            </li>
          ))}
          {!achados.length && <li className="tv-vazio">Nada com esse nome. Apague e veja a lista inteira.</li>}
        </ul>
      </div>
    </div>
  );
}

/** Várias opções: marca e desmarca, depois Continuar. No máximo, as outras ficam travadas; exclusiva fica sozinha. */
function Varias({ opcoes, maximo, exclusivas, onEnviar }: { opcoes: string[]; maximo?: number | null; exclusivas?: string[] | null; onEnviar: (v: string) => void }) {
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const cheio = !!maximo && marcadas.length >= maximo;
  const alternar = (o: string) => setMarcadas((m) => alternarOpcao(m, o, { exclusivas, maximo }));
  return (
    <div className="tv-row tv-inputrow">
      <div className="tv-ibox">
        {maximo ? <p className="tv-rotulo">Escolha até {maximo}</p> : null}
        <div className="tv-options">
          {opcoes.map((o) => {
            const on = marcadas.includes(o);
            return (
              <button key={o} type="button" className={`tv-opt tv-check${on ? " on" : ""}`} aria-pressed={on} disabled={!on && cheio && !(exclusivas ?? []).includes(o)} onClick={() => alternar(o)}>
                <span className="tv-caixa" aria-hidden="true">{on ? "✓" : ""}</span>
                {o}
              </button>
            );
          })}
        </div>
        <button type="button" className="tv-btn tv-continuar" disabled={!marcadas.length} onClick={() => onEnviar(juntar(opcoes.filter((o) => marcadas.includes(o))))}>
          Continuar
        </button>
      </div>
    </div>
  );
}

function Campo({ p, livre, erro, legal, onEnviar }: { p: Pergunta; livre: boolean; erro: string; legal: React.ReactNode; onEnviar: (v: string) => void }) {
  const [v, setV] = useState("");
  const tel = !livre && p.tipo === "telefone";
  const tipo = livre ? "text" : p.tipo === "email" ? "email" : tel ? "tel" : "text";
  const rotulo = livre ? p.outro?.rotulo : p.rotulo;
  const enviar = () => v.trim() && onEnviar(v);
  return (
    <div className="tv-row tv-inputrow">
      <div className="tv-ibox">
        {rotulo && <p className="tv-rotulo">{rotulo}</p>}
        <div className={`tv-field${tel ? " phone" : ""}`}>
          {tel && (
            <span className="tv-wa">
              <IconeWhatsApp cor="#25d366" />
            </span>
          )}
          <input
            aria-label={rotulo || p.texto}
            type={tipo}
            inputMode={tel ? "tel" : tipo === "email" ? "email" : "text"}
            placeholder={(livre ? p.outro?.placeholder : p.placeholder) ?? ""}
            autoComplete="off"
            autoFocus
            value={v}
            onChange={(e) => setV(tel ? mascaraTelefone(e.target.value) : e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar()}
          />
          <button type="button" className="tv-send" aria-label="Enviar" disabled={!v.trim()} onClick={enviar}>
            ↑
          </button>
        </div>
        <div className="tv-err" role="alert">
          {erro}
        </div>
        {legal}
      </div>
    </div>
  );
}

/**
 * A conversa inteira. `previa` = editor do painel: não grava nada e não dispara pixel.
 */
export function Conversa({ bot, previa = false }: { bot: FormularioPublico; previa?: boolean }) {
  const { cores, textos, pixels } = useMemo(() => mesclar(bot), [bot]);
  const agenda = useMemo(() => mesclarAgendamento(bot.agendamento, urlCall()), [bot]);
  const [estado, setEstado] = useState<Estado | null>(null);
  const motor = useRef<Motor | null>(null);
  const chat = useRef<HTMLElement>(null);

  useEffect(() => {
    // em dev o StrictMode monta duas vezes: a conversa desmontada para de mexer na tela
    let viva = true;
    const m = new Motor(bot, textos, agenda, previa, (e) => viva && setEstado(e), (eventId, desqualificado) => {
      if (!deveDispararLead(pixels, desqualificado)) return;
      const r = m.estado.respostas;
      disparar(pixels.acoes.lead, eventId, { email: porPapel(bot.perguntas, r, "email"), telefone: porPapel(bot.perguntas, r, "whatsapp") });
    });
    motor.current = m;
    setEstado(m.estado);
    if (!previa) iniciarPixels(pixels);
    void m.iniciar();
    return () => {
      viva = false;
      motor.current = null;
    };
    // o editor recria a conversa a cada mudança pelo `key`; aqui só roda uma vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const qtd = estado?.mensagens.length ?? 0;
  const fase = estado?.fase;
  useEffect(() => {
    const el = chat.current;
    if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
  }, [qtd, estado?.entrada, fase]);

  const vars = {
    "--tv-marca": cores.marca,
    "--tv-marca-2": cores.marca2,
    "--tv-verde": cores.verde,
    "--tv-fundo": cores.fundo,
    "--tv-bolha": cores.bolha,
    "--tv-texto": cores.texto,
  } as React.CSSProperties;
  const avatar = bot.avatar_url ? { backgroundImage: `url(${bot.avatar_url})` } : undefined;
  const prog = estado ? progresso(bot.perguntas, estado.respostas, estado.fase === "respondendo" ? estado.idx : bot.perguntas.length) : { feitas: 0, total: 1 };
  const pct = prog.total ? Math.min(100, Math.round((prog.feitas / prog.total) * 100)) : 0;

  const legal = bot.privacidade_url ? (
    <div className="tv-legal">
      {textos.legalAntes}
      <a href={bot.privacidade_url} target="_blank" rel="noopener">
        Política de Privacidade
      </a>
      {bot.termos_url ? (
        <>
          {" e o "}
          <a href={bot.termos_url} target="_blank" rel="noopener">
            Termo de Consentimento
          </a>
        </>
      ) : null}
      .
    </div>
  ) : null;

  const ent = estado?.entrada;
  const m = motor.current;

  return (
    <div className="tv" style={vars}>
      <header className="tv-topbar">
        {bot.logo_url ? <img className="tv-logo" src={bot.logo_url} alt={bot.nome} /> : <span className="tv-logo-texto">{bot.nome}</span>}
        <div className="tv-progresso" role="progressbar" aria-valuenow={prog.feitas} aria-valuemin={0} aria-valuemax={prog.total}>
          <i style={{ width: `${pct}%` }} />
        </div>
      </header>
      <main className="tv-chat" ref={chat}>
        {estado?.mensagens.map((msg) =>
          msg.de === "lead" ? (
            <div key={msg.id} className="tv-row me">
              <div className="tv-bubble">{msg.texto}</div>
            </div>
          ) : msg.de === "digitando" ? (
            <div key={msg.id} className="tv-row">
              <div className="tv-avatar" style={avatar} />
              <div className="tv-bubble">
                <div className="tv-typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          ) : (
            <div key={msg.id} className="tv-row">
              <div className="tv-avatar" style={avatar} />
              <div className={`tv-bubble${msg.pergunta ? " q" : ""}`} dangerouslySetInnerHTML={{ __html: msg.html ?? "" }} />
            </div>
          ),
        )}

        {m && agenda && estado?.agenda && (
          <Agenda
            sessoes={estado.agenda}
            textos={agenda.textos}
            whatsapp={linkWhatsapp(agenda.whatsapp, agenda.mensagemWhatsapp)}
            irProWhatsapp={!previa && agenda.abrirWhatsappSozinho}
            recarregar={() => m.recarregarHorarios()}
            agendar={(s) => m.agendar(s)}
          />
        )}

        {m && ent?.tipo === "escolha" && <Opcoes key={ent.p.slug} opcoes={ent.p.opcoes ?? []} onEscolher={(o) => void m.responder(o)} />}
        {m && ent?.tipo === "varias" && <Varias key={ent.p.slug} opcoes={ent.p.opcoes ?? []} maximo={ent.p.maximo} exclusivas={ent.p.exclusivas} onEnviar={(v) => void m.responder(v)} />}
        {m && ent && (ent.tipo === "texto" || ent.tipo === "livre") && (
          <Campo key={`${ent.p.slug}-${ent.tipo}`} p={ent.p} livre={ent.tipo === "livre"} erro={estado.erro} legal={legal} onEnviar={(v) => void m.responder(v)} />
        )}

        {m && fase === "falhou" && (
          <div className="tv-row tv-inputrow">
            <div className="tv-ibox tv-retentar">
              <div className="tv-err">{textos.falhou}</div>
              <button type="button" className="tv-btn" onClick={() => void m.terminar()}>
                {textos.tentarDeNovo}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
