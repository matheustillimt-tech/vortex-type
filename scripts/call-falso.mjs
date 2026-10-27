// Vórtex Call de mentira pra testar o agendamento do Vórtex Type na máquina, sem criar inscrição de verdade.
//   node scripts/call-falso.mjs        (porta 3999; PORTA=xxxx pra trocar)
//   .env.local: NEXT_PUBLIC_VORTEX_CALL_URL=http://localhost:3999
// GET  /api/agendamento/<agenda>            próximos 5 dias úteis, 14h, 15h e 16h de Brasília (16h vem lotada)
// POST /api/agendamento/<agenda>/inscrever  horário das 15h: 409 "lotada" na primeira tentativa (e some da lista);
//                                           WhatsApp novo: "nova" com link; de novo: "mesma" (mesmo horário) ou "reagendada"
// Agenda "nao-existe": 404. Cada POST aparece no terminal, pra conferir o corpo.
import http from "node:http";

const PORTA = Number(process.env.PORTA || 3999);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
const lotadas = new Set();
const inscritos = new Map();

function sessoes() {
  const out = [];
  const d = new Date(Date.now() - 3 * 3600_000); // "hoje" em Brasília
  while (out.length < 15) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const dia = d.toISOString().slice(0, 10);
    for (const h of ["14", "15", "16"]) {
      const id = `00000000-0000-4000-8000-${dia.replace(/-/g, "")}${h}00`;
      const lotada = h === "16" || lotadas.has(id);
      out.push({ id, inicio: new Date(`${dia}T${h}:00:00-03:00`).toISOString(), restantes: lotada ? 0 : 15, lotada });
    }
  }
  return out;
}

function responder(res, status, corpo) {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
}

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      return res.end();
    }
    if (req.url.startsWith("/c/")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end("<h1>Sala de teste do Call falso</h1>");
    }
    const m = req.url.match(/^\/api\/agendamento\/([^/?]+)(\/inscrever)?/);
    if (!m) return responder(res, 404, { erro: "Não encontrado." });
    if (m[1] === "nao-existe") return responder(res, 404, { erro: "Agenda não encontrada." });
    if (req.method === "GET" && !m[2]) {
      return responder(res, 200, { agenda: { slug: m[1], titulo_publico: "Agenda de teste", descricao: "", duracao_min: 60 }, sessoes: sessoes() });
    }
    if (req.method !== "POST" || !m[2]) return responder(res, 405, { erro: "Método não aceito." });
    let bruto = "";
    req.on("data", (c) => (bruto += c));
    req.on("end", () => {
      let c = {};
      try {
        c = JSON.parse(bruto || "{}");
      } catch {}
      console.log("[call-falso] inscrever", m[1], JSON.stringify(c));
      const s = sessoes().find((x) => x.id === c.sessao);
      if (!s || s.lotada) return responder(res, 409, { erro: "Esse horário não está mais disponível.", resultado: "indisponivel" });
      if (!c.nome || !/^\+[1-9]\d{7,14}$/.test(c.whatsapp || "")) return responder(res, 400, { erro: "Confira o WhatsApp com DDD." });
      if (s.id.endsWith("1500") && !lotadas.has(s.id)) {
        lotadas.add(s.id);
        return responder(res, 409, { erro: "Esse horário acabou de lotar. Escolha outro.", resultado: "lotada" });
      }
      const antes = inscritos.get(c.whatsapp);
      inscritos.set(c.whatsapp, s.id);
      if (antes) return responder(res, 200, { resultado: antes === s.id ? "mesma" : "reagendada", inicio: s.inicio });
      const codigo = Math.random().toString(36).slice(2, 12).padEnd(10, "x");
      return responder(res, 200, { resultado: "nova", codigo, link: `http://localhost:${PORTA}/c/${codigo}`, inicio: s.inicio });
    });
  })
  .listen(PORTA, () => console.log(`[call-falso] http://localhost:${PORTA}`));
