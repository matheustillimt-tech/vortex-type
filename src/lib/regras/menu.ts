import { areaDoCaminho, pode, type Papel } from "./acesso";

export type ItemMenu = { href: string; rotulo: string; icone: string };

/** Ícones Material: https://fonts.google.com/icons?icon.set=Material+Icons */
export const ITENS_MENU: ItemMenu[] = [
  { href: "/", rotulo: "Início", icone: "home" },
  { href: "/formularios", rotulo: "Formulários", icone: "forum" },
  { href: "/respostas", rotulo: "Respostas", icone: "inbox" },
  { href: "/integracoes", rotulo: "Integrações", icone: "hub" },
  { href: "/equipe", rotulo: "Equipe", icone: "people" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "settings" },
];

export function itensVisiveis(papel: Papel | null): ItemMenu[] {
  return ITENS_MENU.filter((i) => {
    const area = areaDoCaminho(i.href);
    return area !== null && pode(papel, area);
  });
}

export function menuAtivo(item: ItemMenu, atual: string): boolean {
  if (item.href === "/") return atual === "/";
  return atual === item.href || atual.startsWith(`${item.href}/`);
}
