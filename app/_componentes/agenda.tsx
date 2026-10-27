"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { celulasDoMes, chaveMes, DIAS_CURTOS, diaEHora, hojeTexto, mesAno, partesBrasilia, porDia, primeiroDiaComHorarioFuturo, primeiroDiaDoMes } from "@/src/lib/agendamento/horarios";
import { AGENDANDO } from "@/src/lib/agendamento/padroes";
import type { ResultadoInscricao, SessaoCall, TextosAgenda } from "@/src/lib/agendamento/tipos";
import { IconeWhatsApp } from "./icone-whatsapp";

type Fase =
  | { nome: "calendario"; aviso?: string }
  | { nome: "confirmar"; s: SessaoCall }
  | { nome: "agendando" }
  | { nome: "reservado"; inicio: string; link: string | null }
  | { nome: "sem-horarios" };

const FALHAS_PARA_DESISTIR = 3;
/** Tempo na tela "Horário reservado!" antes de abrir o WhatsApp sozinho (o lead vê que deu certo). */
const ESPERA_WHATSAPP_MS = 2000;

const mesDe = (dia: string) => {
  const [y, m] = dia.split("-").map(Number);
  return { y, m: m - 1 };
};

/**
 * Cartão de agenda dentro da conversa:
 * calendário → confirmar → horário reservado. Quem fala com o Vórtex Call é o Motor (`recarregar`, `agendar`).
 */
export function Agenda({
  sessoes,
  textos,
  whatsapp,
  irProWhatsapp = false,
  recarregar,
  agendar,
}: {
  sessoes: SessaoCall[];
  textos: TextosAgenda;
  whatsapp: string | null;
  /** Depois de reservar, abre o WhatsApp sozinho (opção do editor; fora da prévia e fora de iframe, onde o navegador bloqueia). */
  irProWhatsapp?: boolean;
  recarregar: () => Promise<SessaoCall[]>;
  agendar: (s: SessaoCall) => Promise<ResultadoInscricao>;
}) {
  const [lista, setLista] = useState(sessoes);
  const [fase, setFase] = useState<Fase>({ nome: "calendario" });
  // falhou (não lotou) 3 vezes seguidas: agenda provavelmente caiu (desativada, 404 ou 400 repetido). Sai do loop.
  const [falhasSeguidas, setFalhasSeguidas] = useState(0);
  const agoraInicial = new Date();
  // abre já no mês e no dia do primeiro horário que ainda não passou
  const [dia, setDia] = useState<string | null>(() => primeiroDiaComHorarioFuturo(sessoes, agoraInicial));
  const [mes, setMes] = useState(() => mesDe(primeiroDiaComHorarioFuturo(sessoes, agoraInicial) ?? partesBrasilia(agoraInicial).dia));
  const caixa = useRef<HTMLDivElement>(null);
  const dias = useMemo(() => porDia(lista), [lista]);

  useEffect(() => {
    caixa.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [fase.nome]);

  useEffect(() => {
    if (fase.nome !== "reservado" || !whatsapp || !irProWhatsapp || window.self !== window.top) return;
    const t = setTimeout(() => window.location.assign(whatsapp), ESPERA_WHATSAPP_MS);
    return () => clearTimeout(t);
  }, [fase.nome, whatsapp, irProWhatsapp]);

  function irPara(y: number, m: number) {
    setMes({ y, m });
    setDia(primeiroDiaDoMes(dias, y, m));
  }

  async function confirmar(s: SessaoCall) {
    setFase({ nome: "agendando" });
    const r = await agendar(s);
    if (r.tipo === "nova") {
      setFalhasSeguidas(0);
      return setFase({ nome: "reservado", inicio: r.inicio, link: r.link });
    }
    if (r.tipo === "mesma" || r.tipo === "reagendada") {
      setFalhasSeguidas(0);
      return setFase({ nome: "reservado", inicio: r.inicio, link: null });
    }
    // 409: o horário lotou. Recarrega e tira esse da lista (mesmo se a recarga falhar). Outro erro: só volta.
    const restante = r.tipo === "lotou" ? (await recarregar().catch(() => lista)).filter((x) => x.id !== s.id) : lista;
    setLista(restante);
    if (!restante.length) return setFase({ nome: "sem-horarios" });
    const agora = new Date();
    const temFuturo = (h: { inicio: string }) => new Date(h.inicio) > agora;
    const diaAindaValido = dia && (porDia(restante).get(dia) ?? []).some(temFuturo);
    const d = diaAindaValido ? dia : primeiroDiaComHorarioFuturo(restante, agora);
    if (d) {
      setDia(d);
      setMes(mesDe(d));
    }
    if (r.tipo === "lotou") {
      setFalhasSeguidas(0);
      return setFase({ nome: "calendario", aviso: textos.lotou });
    }
    // falhou: depois de 3 vezes seguidas para de pedir pra tentar de novo e mostra "sem horários"
    const falhas = falhasSeguidas + 1;
    setFalhasSeguidas(falhas);
    if (falhas >= FALHAS_PARA_DESISTIR) return setFase({ nome: "sem-horarios" });
    setFase({ nome: "calendario", aviso: textos.naoAgendou });
  }

  const agora = new Date();
  const hoje = partesBrasilia(agora).dia;

  let corpo: React.ReactNode;
  if (fase.nome === "sem-horarios") corpo = <div className="tv-agenda-msg">{textos.semHorarios}</div>;
  else if (fase.nome === "agendando") corpo = <div className="tv-agenda-msg">{AGENDANDO}</div>;
  else if (fase.nome === "reservado") {
    corpo = (
      <>
        <div className="tv-agenda-head">
          <div className="ic">✓</div>
          <div>
            <h3>{textos.reservadoTitulo}</h3>
            <p>{diaEHora(fase.inicio)}</p>
          </div>
        </div>
        <div className="tv-agenda-body centro">
          <p className="tv-agenda-texto">{textos.reservadoTexto}</p>
          <div className="tv-agenda-links">
            {whatsapp && (
              <a className="tv-wa-cta" href={whatsapp} target="_blank" rel="noopener">
                <IconeWhatsApp cor="#fff" /> {textos.botaoWhatsapp}
              </a>
            )}
            {fase.link && (
              <a className="tv-call-cta" href={fase.link} target="_blank" rel="noopener">
                🔗 <span>{textos.verLink}</span>
              </a>
            )}
          </div>
        </div>
      </>
    );
  } else if (fase.nome === "confirmar") {
    const s = fase.s;
    corpo = (
      <>
        <div className="tv-agenda-head">
          <div className="ic">🔔</div>
          <div>
            <h3>{textos.confirmarTitulo}</h3>
            <p>{diaEHora(s.inicio)}</p>
          </div>
        </div>
        <div className="tv-agenda-body centro">
          <p className="tv-agenda-texto">{textos.confirmarTexto}</p>
          <div className="tv-agenda-acoes">
            <button type="button" className="tv-btn-confirmar" onClick={() => void confirmar(s)}>
              {textos.confirmarBotao}
            </button>
            <button type="button" className="tv-btn-outro" onClick={() => setFase({ nome: "calendario" })}>
              {textos.outroHorario}
            </button>
          </div>
        </div>
      </>
    );
  } else {
    const { y, m } = mes;
    const doDia = dia ? (dias.get(dia) ?? []).filter((h) => new Date(h.inicio) > agora) : [];
    const podeVoltar = chaveMes(y, m) > hoje.slice(0, 7);
    const podeIr = [...dias.keys()].some((d) => d.slice(0, 7) > chaveMes(y, m));
    corpo = (
      <>
        <div className="tv-agenda-head">
          <div className="ic">📅</div>
          <div>
            <h3>{textos.agendaTitulo}</h3>
            <p>{textos.agendaSubtitulo}</p>
          </div>
        </div>
        <div className="tv-agenda-body">
          <div className="tv-hoje">🕒 {hojeTexto(agora)}</div>
          <div className="tv-calnav">
            <button type="button" aria-label="Mês anterior" disabled={!podeVoltar} onClick={() => (m === 0 ? irPara(y - 1, 11) : irPara(y, m - 1))}>
              ‹
            </button>
            <div className="mn">{mesAno(y, m)}</div>
            <button type="button" aria-label="Próximo mês" disabled={!podeIr} onClick={() => (m === 11 ? irPara(y + 1, 0) : irPara(y, m + 1))}>
              ›
            </button>
          </div>
          <div className="tv-cgrid">
            {DIAS_CURTOS.map((d) => (
              <div key={d} className="wd">
                {d}
              </div>
            ))}
            {celulasDoMes(y, m).map((c, i) =>
              c === null ? (
                <div key={`v${i}`} className="tv-day" />
              ) : (
                <button
                  key={c.chave}
                  type="button"
                  className={`tv-day${dias.has(c.chave) && c.chave >= hoje ? " has" : ""}${dia === c.chave ? " sel" : ""}`}
                  disabled={!dias.has(c.chave) || c.chave < hoje}
                  aria-pressed={dia === c.chave}
                  onClick={() => setDia(c.chave)}
                >
                  {c.dia}
                </button>
              ),
            )}
          </div>
          {doDia.length > 0 && (
            <div className="tv-times">
              {doDia.map((h) => (
                <button key={h.id} type="button" className="tv-time" onClick={() => setFase({ nome: "confirmar", s: h })}>
                  {partesBrasilia(h.inicio).hora}
                </button>
              ))}
            </div>
          )}
          {fase.aviso && (
            <div className="tv-err" role="alert">
              {fase.aviso}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="tv-row agenda-row" ref={caixa}>
      <div className="tv-agenda" data-testid="agenda">
        {corpo}
      </div>
    </div>
  );
}
