import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="max-w-md mx-auto w-full p-4 h-full overflow-y-auto pb-24">
      <h2 className="text-[24px] font-bold text-on-surface mb-6">Profil Akun</h2>
      
      <div className="bg-surface-container-lowest border border-surface-container-highest rounded-[20px] p-6 shadow-level-1 mb-6">
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center text-[36px] font-bold mb-4">
            {user?.name?.charAt(0).toUpperCase() || user?.email.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-[20px] font-bold text-on-surface">{user?.name}</h3>
          <p className="text-[14px] text-on-surface-variant">{user?.email}</p>
          <span className="mt-2 px-3 py-1 bg-surface-container text-on-surface text-[12px] font-bold rounded-full">
            {user?.role === "DRIVER" ? "Pengemudi" : "Pelanggan"}
          </span>
        </div>

        <div className="border-t border-surface-container-highest pt-6">
          <div className="mb-4">
            <label className="block text-[12px] font-bold text-on-surface-variant mb-1">
              ID Akun
            </label>
            <div className="text-[14px] text-on-surface font-mono bg-surface-container-low p-3 rounded-[12px]">
              {user?.id}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full h-12 flex items-center justify-center bg-error-container text-on-error-container text-[16px] font-bold rounded-full hover:bg-error-container/90 transition-all"
      >
        Keluar Akun
      </button>
    </div>
  );
}
