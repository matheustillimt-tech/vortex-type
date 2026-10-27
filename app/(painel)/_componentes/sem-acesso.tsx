import Link from "next/link";
import { Icone } from "./icone";
import { Pagina, Vazio, estiloBotao } from "./ui";

export function SemAcesso() {
  return (
    <Pagina titulo="Sem acesso">
      <Vazio icone={<Icone nome="lock" tamanho={16} />} texto="Você não tem acesso a esta área." acao={<Link href="/" className={estiloBotao("principal")}>Início</Link>} />
    </Pagina>
  );
}
