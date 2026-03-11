import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import ProjectMasterPage from './pages/ProjectMasterPage';
import MonthControlPage from './pages/MonthControlPage';
import InputDashboardPage from './pages/InputDashboardPage';
import InputDashboardPageV2 from './pages/InputDashboardPageV2';
import InputDashboardPageV3 from './pages/InputDashboardPageV3';
import SettingsPage from './pages/SettingsPage';
import DashboardHomePage from './pages/DashboardHomePage';
import DashboardHomePageV2 from './pages/DashboardHomePageV2';
import DashboardHomePageV3 from './pages/DashboardHomePageV3';
import InternalRatesPage from './pages/InternalRatesPage';
import AnnualGoalsPage from './pages/AnnualGoalsPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';


// Helper Component for Port-Based Routing
const PortRedirect = () => {
  const port = window.location.port;

  if (port === '5174') return <DashboardHomePageV3 />;
  if (port === '5173') return <DashboardHomePage />; // V1

  // Default (5175 or Render/Production) -> V2 (Latest Stable)
  return <DashboardHomePageV2 />;
};

const PortInputRedirect = () => {
  const port = window.location.port;
  if (port === '5174') return <InputDashboardPageV3 />;
  if (port === '5173') return <InputDashboardPage />; // V1

  // Default (5175 or Render/Production) -> V2 (Latest Stable)
  return <InputDashboardPageV2 />;
};


export default function App() {
  return (
    <LanguageProvider>
      <DataProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Layout Route (Global Gate) */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                {/* Public Access (inside Gate) */}
                <Route index element={<PortRedirect />} />

                {/* Admin Access (Level 2) */}
                <Route path="goals" element={<AdminRoute><AnnualGoalsPage /></AdminRoute>} />
                <Route path="projects" element={<AdminRoute><ProjectMasterPage /></AdminRoute>} />
                <Route path="rates" element={<AdminRoute><InternalRatesPage /></AdminRoute>} />
                <Route path="calendar" element={<AdminRoute><MonthControlPage /></AdminRoute>} />
                <Route path="input/:teamId" element={<AdminRoute><PortInputRedirect /></AdminRoute>} />

                {/* Versioned Routes - Still accessible manually */}
                <Route path="input-v1/:teamId" element={<AdminRoute><InputDashboardPage /></AdminRoute>} />
                <Route path="input-v2/:teamId" element={<AdminRoute><InputDashboardPageV2 /></AdminRoute>} />
                <Route path="input-v3/:teamId" element={<AdminRoute><InputDashboardPageV3 /></AdminRoute>} />

                <Route path="dashboard-v1" element={<DashboardHomePage />} />
                <Route path="dashboard-v2" element={<DashboardHomePageV2 />} />
                <Route path="dashboard-v3" element={<DashboardHomePageV3 />} />

                <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </DataProvider>
    </LanguageProvider >
  );
}
