import { useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Consumers from "./pages/Consumers";
import ServiceConnections from "./pages/ServiceConnections";
import Meters from "./pages/Meters";
import Records from "./pages/Records";
import Bills from "./pages/Bills";
import Payments from "./pages/Payments";
import TariffPlans from "./pages/TariffPlans";
import ConnectionTariffs from "./pages/ConnectionTariffs";
import AuthPage from "./pages/AuthPage";

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ubms_session") || "null");
    } catch {
      return null;
    }
  });

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem("ubms_session", JSON.stringify(user));
  };

  const handleLogout = () => {
    localStorage.removeItem("ubms_session");
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <Router>
      <div className="app-shell">
        <Sidebar />

        <main className="app-main">
          <header className="app-topbar">
            <div>
              <h1>Utility Billing Management System</h1>
              <p>Manage consumers, usage, billing, and payments in one unified dashboard.</p>
            </div>
            <div className="topbar-actions">
              <span>{currentUser.name}</span>
              <button onClick={handleLogout}>Logout</button>
            </div>
          </header>

          <section className="page-panel">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/consumers" element={<Consumers />} />
              <Route path="/connections" element={<ServiceConnections />} />
              <Route path="/meters" element={<Meters />} />
              <Route path="/records" element={<Records />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/payments" element={<Payments />} />

              <Route path="/tariffs" element={<TariffPlans />} />
              <Route path="/connection-tariffs" element={<ConnectionTariffs />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </section>
        </main>
      </div>
    </Router>
  );
}

export default App;