import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { normalizarHost, rotaNoDominioDoCliente, usarRoteamentoDeDominio } from "@/src/lib/regras/dominio";
import { tipoRota } from "@/src/lib/regras/rotas";

/** Só o painel pede login. `/login`, `/api/*` (cada rota confere a própria chave) e os formulários são públicos. */
export function exigeLogin(pathname: string): boolean {
  return tipoRota(pathname) === "painel";
}

/** Qual formulário abre no domínio (cache de 60 s por host, também pra "nenhum"). */
const CACHE_DOMINIO = new Map<string, { slug: string | null; ate: number }>();
async function slugDoDominio(host: string): Promise<string | null> {
  const c = CACHE_DOMINIO.get(host);
  if (c && c.ate > Date.now()) return c.slug;
  let slug: string | null = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/formulario_do_dominio`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ p_host: host }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[dominio] falha ao consultar", host, res.status);
      slug = null;
    } else {
      slug = (await res.json()) as string | null;
    }
  } catch (e) {
    console.error("[dominio] falha ao consultar", host, e);
    slug = null;
  }
  if (CACHE_DOMINIO.size > 500) CACHE_DOMINIO.clear();
  CACHE_DOMINIO.set(host, { slug, ate: Date.now() + 60_000 });
  return slug;
}

/** Sem endereço principal configurado, domínios próprios ficam desligados (nunca derruba o painel); avisa uma
 *  única vez por processo. */
let avisouSemPrincipal = false;

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const principal = (() => {
    try {
      return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null;
    } catch {
      return null;
    }
  })();
  if (!principal && !avisouSemPrincipal) {
    avisouSemPrincipal = true;
    console.warn("[dominio] NEXT_PUBLIC_SITE_URL ausente: domínios próprios desligados");
  }
  if (host && usarRoteamentoDeDominio(host, principal)) {
    const slug = await slugDoDominio(normalizarHost(host));
    const acao = slug ? rotaNoDominioDoCliente(req.nextUrl.pathname, slug) : "404";
    if (acao === "reescrever") return NextResponse.rewrite(new URL(`/${slug}${req.nextUrl.search}`, req.url));
    if (acao === "passar") return NextResponse.next();
    return NextResponse.rewrite(new URL("/_dominio-sem-formulario", req.url), { status: 404 });
  }

  if (!exigeLogin(req.nextUrl.pathname)) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", req.url));
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
