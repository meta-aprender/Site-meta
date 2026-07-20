"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        name="password"
        placeholder="Senha"
        required
        autoComplete="current-password"
        className="w-full bg-[#0F172A] border border-white/10 p-3 pr-12 rounded-lg text-white outline-none focus:border-cyanBright"
      />

      <button
        type="button"
        onClick={() => setShowPassword((current) => !current)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
      >
        {showPassword ? (
          <EyeOff className="w-5 h-5" />
        ) : (
          <Eye className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}