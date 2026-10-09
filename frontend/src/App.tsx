import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { UserDashboardPage } from "./pages/UserDashboardPage";
import { DatasetsPage } from "./pages/DatasetsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { AnalyticsDashboardPage } from "./pages/AnalyticsDashboardPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<UserDashboardPage />} />
              <Route path="/datasets" element={<DatasetsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/analytics" element={<AnalyticsDashboardPage />} />
            </Route>
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
