import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm"; // Importa o formulário que criamos
import PasswordInput from "./PasswordInput";

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Checa no servidor se o usuário já tem uma sessão ativa
  const session = await getServerSession();

  // Se já estiver logado, redireciona IMEDIATAMENTE antes de renderizar a tela
  if (session) {
    redirect("/admin/dashboard");
  }

  // Se não estiver logado, mostra o formulário para ele digitar a senha
  return <LoginForm />;
}