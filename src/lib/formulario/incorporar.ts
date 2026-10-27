/** Código pra colocar o formulário dentro de outro site (iframe). Puro. */

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function codigoIframe(link: string): string {
  return `<iframe src="${escapar(link)}" title="Formulário" style="width:100%;height:640px;border:0;border-radius:12px" loading="lazy"></iframe>`;
}
