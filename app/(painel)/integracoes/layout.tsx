import { AbasIntegracoes } from "./abas";

export default function LayoutIntegracoes({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <h1 className="mb-4 text-[22px] font-semibold tracking-[-0.02em]">Integrações</h1>
      <AbasIntegracoes />
      {children}
    </div>
  );
}
