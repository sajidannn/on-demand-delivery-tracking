import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <nav className="bg-surface-container-lowest shadow-level-1 relative z-1000">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-[20px] font-bold text-primary tracking-[-0.02em]">
                UrbanLogis
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-[14px] font-medium text-on-surface">
                {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-[12px] font-bold text-error hover:bg-error-container hover:text-on-error-container px-4 py-2 rounded-full transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="flex-1 w-full relative">
        <Outlet />
      </main>
    </div>
  );
}
