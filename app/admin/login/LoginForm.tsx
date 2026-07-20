"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("E-mail ou senha inválidos.");
        setLoading(false);
        return;
      }

      router.refresh();
      router.replace("/admin/dashboard");
    } catch {
      setError("Ocorreu um erro ao tentar entrar.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A192F] px-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/10 p-8 rounded-2xl shadow-2xl">

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-vibrantPurple rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(156,39,176,0.5)]">
            <Lock className="text-white w-6 h-6" />
          </div>

          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
            Acesso Restrito
          </h1>

          <p className="text-gray-400 text-sm mt-2">
            Identifique-se para gerenciar o sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* E-MAIL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              E-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0A192F]/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-vibrantPurple focus:ring-1 focus:ring-vibrantPurple transition-all"
              placeholder="admin@metaaprender.com"
              autoComplete="email"
              required
            />
          </div>

          {/* SENHA */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Senha
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0A192F]/50 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white focus:outline-none focus:border-vibrantPurple focus:ring-1 focus:ring-vibrantPurple transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                aria-label={
                  showPassword
                    ? "Ocultar senha"
                    : "Mostrar senha"
                }
                title={
                  showPassword
                    ? "Ocultar senha"
                    : "Mostrar senha"
                }
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* ERRO */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* BOTÃO */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-vibrantPurple hover:bg-[#8e24a1] text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-neon-purple disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
          >
            {loading ? "Entrando..." : "Acessar Painel"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Voltar para o site
          </a>
        </div>

      </div>
    </div>
  );
}