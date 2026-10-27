/** Domínio próprio de formulário (o cliente aponta, por exemplo, aplicacao.cliente.com pro formulário). Puro. */

const ROTULO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
/** Sufixos de dois níveis comuns no Brasil (domínio raiz fica em 3 partes: cliente.com.br). */
const SUFIXOS_DUPLOS = ["com.br", "net.br", "org.br", "art.br", "adv.br", "eng.br", "med.br", "edu.br", "gov.br", "ind.br", "inf.br", "app.br", "dev.br", "co.uk", "com.ar", "com.pt"];

export function normalizarHost(v: string): string {
  let t = v.trim().toLowerCase().replace(/^[a-z]+:\/\//, "");
  t = t.split(/[/?#]/)[0].split(":")[0];
  return t.replace(/\.$/, "");
}

export function hostValido(h: string): boolean {
  if (h.length > 253 || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.endsWith(".vercel.app")) return false;
  const partes = h.split(".");
  return partes.length >= 2 && partes.every((p) => ROTULO.test(p) && p.length <= 63) && /[a-z]/.test(partes[partes.length - 1]);
}

/** Endereços que são do próprio sistema (painel normal): o principal, *.vercel.app e local. */
export function ehHostDoSistema(host: string, hostPrincipal: string | null): boolean {
  const h = host.toLowerCase().split(":")[0].replace(/\.$/, "");
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".vercel.app") || (!!hostPrincipal && h === hostPrincipal.toLowerCase().replace(/\.$/, ""));
}

/** Só passa pelo roteamento de domínio próprio quando existe um endereço principal configurado e o host não é
 *  do sistema. Sem `hostPrincipal` (ex.: `NEXT_PUBLIC_SITE_URL` ausente/inválido), domínios próprios ficam
 *  desligados e todo host segue como painel normal — nunca derruba o painel por falta de configuração. */
export function usarRoteamentoDeDominio(host: string, hostPrincipal: string | null): boolean {
  if (!hostPrincipal) return false;
  return !ehHostDoSistema(host, hostPrincipal);
}

/** No domínio do cliente só o formulário abre: `/` vira o formulário, assets passam, o resto é 404. */
export function rotaNoDominioDoCliente(pathname: string, slug: string): "reescrever" | "passar" | "404" {
  if (pathname === "/") return "reescrever";
  if (pathname === `/${slug}` || pathname.startsWith("/_next/") || /^\/[^/]+\.(svg|png|ico|jpg|jpeg|webp|txt|xml|webmanifest)$/.test(pathname)) return "passar";
  return "404";
}

function ehRaiz(host: string): boolean {
  const partes = host.split(".");
  const duplo = SUFIXOS_DUPLOS.some((s) => host.endsWith(`.${s}`));
  return partes.length === (duplo ? 3 : 2);
}

/** Registro que o cliente cria no DNS dele (padrão da Vercel). */
export function registroDns(host: string): { tipo: "A" | "CNAME"; nome: string; valor: string } {
  if (ehRaiz(host)) return { tipo: "A", nome: "@", valor: "76.76.21.21" };
  const partes = host.split(".");
  const tamanhoRaiz = SUFIXOS_DUPLOS.some((s) => host.endsWith(`.${s}`)) ? 3 : 2;
  return { tipo: "CNAME", nome: partes.slice(0, partes.length - tamanhoRaiz).join("."), valor: "cname.vercel-dns.com" };
}
