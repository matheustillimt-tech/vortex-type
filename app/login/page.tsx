import { lerMarca } from "@/src/lib/marca-servidor";
import { BannerLogin } from "./banner";
import { FormLogin } from "./form";

export default async function Login() {
  const marca = await lerMarca();
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <BannerLogin marca={marca} />
      <div className="flex items-center justify-center bg-[radial-gradient(60%_45%_at_50%_0%,rgba(15,169,104,0.1),transparent)] px-4 py-12">
        <FormLogin marca={marca} />
      </div>
    </main>
  );
}
