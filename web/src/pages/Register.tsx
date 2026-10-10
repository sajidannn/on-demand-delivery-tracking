import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { apiClient } from "../lib/api/client";
import { useAuth } from "../contexts/AuthContext";
import type { User } from "../contexts/AuthContext";

export default function Register() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CUSTOMER" | "DRIVER">("CUSTOMER");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const { user, login } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const { error: apiError } = await apiClient.POST("/auth/register", {
        body: { email, password, name, role },
      });

      if (apiError) {
        setError(apiError.message ? String(apiError.message) : "Pendaftaran gagal");
        return;
      }

      // Automatically log in after registration
      const { error: loginError } = await apiClient.POST("/auth/login", {
        body: { email, password },
      });

      if (loginError) {
        setError("Pendaftaran berhasil, tetapi gagal masuk otomatis. Silakan masuk manual.");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      const { data: meData, error: meError } = await apiClient.GET("/auth/me");
      if (meError || !meData) {
        setError("Gagal mengambil data akun setelah mendaftar");
        return;
      }

      login(meData as User);
      navigate("/");
    } catch (_err) {
      setError("Terjadi kesalahan tak terduga");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-[20px] shadow-level-1 border border-surface-container-highest p-6 sm:p-8">
        <div className="text-center mb-8">
          <h2 className="text-[26px] font-bold text-on-surface tracking-[-0.02em] leading-8.5">
            Buat Akun Baru
          </h2>
          <p className="mt-2 text-[14px] text-on-surface-variant">
            Bergabung dengan UrbanLogis sekarang
          </p>
        </div>
        
        {error && (
          <div className="mb-6 bg-error-container text-on-error-container p-3 rounded-[12px] text-[14px] font-medium text-center">
            {error}
          </div>
        )}

        {/* Role Switcher */}
        <div className="mb-6 p-1 bg-surface-container-low border border-surface-container-highest rounded-full flex relative">
          <button
            type="button"
            onClick={() => setRole("CUSTOMER")}
            className={`flex-1 h-11 text-[14px] font-bold rounded-full transition-all duration-200 z-10 ${
              role === "CUSTOMER" 
                ? "bg-surface-container-lowest shadow-level-1 text-on-surface" 
                : "text-on-surface-variant"
            }`}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setRole("DRIVER")}
            className={`flex-1 h-11 text-[14px] font-bold rounded-full transition-all duration-200 z-10 ${
              role === "DRIVER" 
                ? "bg-surface-container-lowest shadow-level-1 text-on-surface" 
                : "text-on-surface-variant"
            }`}
          >
            Driver
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-[12px] font-semibold text-on-surface mb-2" htmlFor="name">
              Nama Lengkap
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full h-12 px-4 bg-surface-container-low border border-surface-container-highest rounded-[20px] text-[14px] text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
              placeholder="Nama lengkap Anda"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-on-surface mb-2" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full h-12 px-4 bg-surface-container-low border border-surface-container-highest rounded-[20px] text-[14px] text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
              placeholder="contoh@email.com"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-on-surface mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full h-12 px-4 bg-surface-container-low border border-surface-container-highest rounded-[20px] text-[14px] text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
              placeholder="Minimal 6 karakter"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 mt-6 flex items-center justify-center bg-primary-container text-[#052E16] text-[14px] font-bold rounded-full hover:bg-primary-container/90 focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? "Mendaftar..." : "Daftar"}
          </button>
          
          <div className="mt-6 text-center text-[14px]">
            <span className="text-on-surface-variant">Sudah punya akun? </span>
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Masuk di sini
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
