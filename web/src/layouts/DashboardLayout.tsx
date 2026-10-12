import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function DashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();



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
            <div className="flex items-center space-x-1 sm:space-x-4">
              <Link
                to={user?.role === "DRIVER" ? "/driver" : "/customer"}
                className={`text-[14px] font-bold px-3 py-2 rounded-full transition-colors ${
                  location.pathname === "/driver" || location.pathname === "/customer"
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface hover:bg-surface-container-low"
                }`}
              >
                Beranda
              </Link>
              <Link
                to={user?.role === "DRIVER" ? "/driver/history" : "/customer/history"}
                className={`text-[14px] font-bold px-3 py-2 rounded-full transition-colors ${
                  location.pathname.includes("/history")
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface hover:bg-surface-container-low"
                }`}
              >
                Riwayat
              </Link>
              <Link
                to={user?.role === "DRIVER" ? "/driver/profile" : "/customer/profile"}
                className={`text-[14px] font-bold px-3 py-2 rounded-full transition-colors ${
                  location.pathname.includes("/profile")
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface hover:bg-surface-container-low"
                }`}
              >
                Profil
              </Link>
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
