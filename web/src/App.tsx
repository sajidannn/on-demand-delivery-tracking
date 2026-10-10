import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardLayout from "./layouts/DashboardLayout";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import OrderTracking from "./pages/customer/OrderTracking";
import DriverDashboard from "./pages/driver/DriverDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: "CUSTOMER" | "DRIVER" }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function RoleBasedRedirect() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  
  if (!user) return <Navigate to="/login" replace />;
  
  return <Navigate to={user.role === "CUSTOMER" ? "/customer" : "/driver"} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Redirect root based on role */}
            <Route path="/" element={<RoleBasedRedirect />} />

            {/* Dashboard Routes */}
            <Route element={<DashboardLayout />}>
              <Route 
                path="/customer/*" 
                element={
                  <ProtectedRoute allowedRole="CUSTOMER">
                    <Routes>
                      <Route path="/" element={<CustomerDashboard />} />
                      <Route path="/track/:orderId" element={<OrderTracking />} />
                    </Routes>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/driver/*" 
                element={
                  <ProtectedRoute allowedRole="DRIVER">
                    <DriverDashboard />
                  </ProtectedRoute>
                } 
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
