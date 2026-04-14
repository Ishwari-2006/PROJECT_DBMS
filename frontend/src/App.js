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
              <span>{currentUser.name} | {currentUser.department}</span>
              <button onClick={handleLogout}>Logout</button>
            </div>
          </header>

          <section className="page-panel">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/consumers" element={<Consumers />} />
              <Route path="/connections" element={<ServiceConnections department={currentUser.department} />} />
              <Route path="/meters" element={<Meters department={currentUser.department} />} />
              <Route path="/records" element={<Records department={currentUser.department} />} />
              <Route path="/bills" element={<Bills department={currentUser.department} />} />
              <Route path="/payments" element={<Payments department={currentUser.department} />} />

              <Route path="/tariffs" element={<TariffPlans department={currentUser.department} />} />
              <Route path="/connection-tariffs" element={<ConnectionTariffs department={currentUser.department} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </section>
        </main>
      </div>
    </Router>
  );
}

export default App;