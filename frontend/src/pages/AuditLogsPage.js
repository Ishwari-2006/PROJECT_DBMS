import { useEffect, useState } from "react";
import axios from "axios";

function AuditLogsPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser || currentUser.role !== "Admin") {
      return;
    }

    axios
      .get("http://127.0.0.1:5000/audit-logs", { params: { limit: 200 } })
      .then((response) => setRows(response.data || []))
      .catch((err) => setError(err?.response?.data?.message || "Failed to fetch audit logs"));
  }, [currentUser]);

  if (!currentUser || currentUser.role !== "Admin") {
    return (
      <div className="ops-shell">
        <h1>Audit Logs</h1>
        <p className="ops-error">Only Admin can view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="ops-shell">
      <h1>Audit Logs</h1>
      <p>Every create, update, and delete action is tracked for accountability.</p>
      {error && <p className="ops-error">{error}</p>}

      <div className="ops-card">
        <h3>Recent Activity</h3>
        {!rows.length ? (
          <p className="ops-empty">No audit records found.</p>
        ) : (
          <div className="ops-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.audit_id}>
                    <td>{row.audit_id}</td>
                    <td>{row.created_at}</td>
                    <td>{row.action_type}</td>
                    <td>{row.entity_name}</td>
                    <td>{row.entity_id}</td>
                    <td>{row.department || "-"}</td>
                    <td>{row.actor_role || "-"}</td>
                    <td>{row.actor_name || row.actor_email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLogsPage;
