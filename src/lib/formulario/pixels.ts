/** Pixels do formulário (Meta, TikTok, Google). Cada um só carrega se o formulário tiver o ID configurado. */
import type { AcoesPixel, Pixels } from "./tipos";

/* eslint-disable @typescript-eslint/no-explicit-any */
type W = Window & { fbq?: any; _fbq?: any; ttq?: any; gtag?: any; dataLayer?: any[]; TiktokAnalyticsObject?: string };

function script(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** ID de pixel aceito: Meta (números), TikTok (letras e números), Google (`G-…`, `AW-…`). Nada que mexa na URL do script. */
export const idPixelValido = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(id);
/** Conversão do Google Ads: `AW-123/rótulo` (uma barra só). */
export const conversaoGoogleValida = (s: unknown): s is string => typeof s === "string" && /^AW-[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(s);

let iniciado = false;

export function iniciarPixels(pixels: Pixels) {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  const w = window as W;
  const p = { meta: pixels.meta.filter(idPixelValido), tiktok: pixels.tiktok.filter(idPixelValido), google: pixels.google.filter(idPixelValido) };

  if (p.meta.length) {
    if (!w.fbq) {
      const n: any = function (...a: any[]) {
        n.callMethod ? n.callMethod(...a) : n.queue.push(a);
      };
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      w.fbq = n;
      if (!w._fbq) w._fbq = n;
      script("https://connect.facebook.net/en_US/fbevents.js");
    }
    for (const id of p.meta) w.fbq("init", id);
    w.fbq("track", "PageView");
  }

  if (p.tiktok.length) {
    w.TiktokAnalyticsObject = "ttq";
    const ttq: any = (w.ttq = w.ttq || []);
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = (t: any, e: string) => (t[e] = (...a: any[]) => t.push([e, ...a]));
    for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
    ttq.load = (id: string) => script(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${id}&lib=ttq`);
    for (const id of p.tiktok) ttq.load(id);
    ttq.page();
  }

  if (p.google.length) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () {
      // gtag precisa do objeto arguments, não de um array
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    script(`https://www.googletagmanager.com/gtag/js?id=${p.google[0]}`);
    w.gtag("js", new Date());
    for (const id of p.google) w.gtag("config", id);
  }
}

/** Dispara os eventos configurados quando a pessoa conclui. `eventId` deduplica com a API de conversões. */
export function disparar(acoes: AcoesPixel, eventId: string, dados: { email?: string; telefone?: string } = {}) {
  const w = window as W;
  try {
    if (w.fbq) for (const ev of acoes.meta) w.fbq("track", ev, {}, { eventID: eventId });
    if (w.ttq) {
      if (dados.email || dados.telefone) w.ttq.identify({ email: dados.email, phone_number: dados.telefone ? `+${dados.telefone}` : undefined });
      for (const ev of acoes.tiktok) w.ttq.track(ev, {}, { event_id: eventId });
    }
    if (w.gtag) for (const send_to of acoes.google.filter(conversaoGoogleValida)) w.gtag("event", "conversion", { send_to, transaction_id: eventId });
  } catch {}
}
