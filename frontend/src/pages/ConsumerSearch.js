import { useState } from "react";
import axios from "axios";

function DataTable({ title, rows, columns }) {
  return (
    <div className="ops-card">
      <h3>{title}</h3>
      {!rows.length ? (
        <p className="ops-empty">No data available.</p>
      ) : (
        <div className="ops-table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {columns.map((column) => (
                    <td key={column.key}>{row[column.key] ?? "-"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConsumerSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    setProfile(null);
    setSelectedId(null);

    try {
      const response = await axios.get("http://127.0.0.1:5000/search/consumers", {
        params: { q: query.trim() }
      });
      setResults(response.data || []);
    } catch (err) {
      setResults([]);
      setError(err?.response?.data?.message || "Failed to search consumers.");
    }
  };

  const openProfile = async (consumerId) => {
    setError("");
    setSelectedId(consumerId);

    try {
      const response = await axios.get(`http://127.0.0.1:5000/consumers/${consumerId}/profile`);
      setProfile(response.data || null);
    } catch (err) {
      setProfile(null);
      setError(err?.response?.data?.message || "Failed to load consumer profile.");
    }
  };

  return (
    <div className="ops-shell">
      <h1>Consumer Search Workbench</h1>
      <p>Search by consumer name, consumer ID, or contact number and get the complete profile in one place.</p>

      <form className="ops-search" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type consumer name / ID / contact"
        />
        <button type="submit">Search</button>
      </form>

      {error && <p className="ops-error">{error}</p>}

      {!!results.length && (
        <div className="ops-card">
          <h3>Search Results</h3>
          <div className="ops-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Total Conn.</th>
                  <th>Active Conn.</th>
                  <th>Unpaid Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.consumer_id}>
                    <td>{row.consumer_id}</td>
                    <td>{row.name}</td>
                    <td>{row.contact_no}</td>
                    <td>{row.consumer_type}</td>
                    <td>{row.total_connections}</td>
                    <td>{row.active_connections}</td>
                    <td>{Number(row.unpaid_amount || 0).toFixed(2)}</td>
                    <td>
                      <button type="button" onClick={() => openProfile(row.consumer_id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {profile && (
        <div className="ops-profile-grid">
          <div className="ops-card">
            <h3>Consumer Profile</h3>
            <p><strong>ID:</strong> {profile.consumer?.consumer_id}</p>
            <p><strong>Name:</strong> {profile.consumer?.name}</p>
            <p><strong>Contact:</strong> {profile.consumer?.contact_no}</p>
            <p><strong>Address:</strong> {profile.consumer?.address}</p>
            <p><strong>Type:</strong> {profile.consumer?.consumer_type}</p>
            <p><strong>Registration:</strong> {profile.consumer?.registration_date?.slice?.(0, 10) || profile.consumer?.registration_date}</p>
            <hr />
            <p><strong>Total Connections:</strong> {profile.quickStats?.totalConnections}</p>
            <p><strong>Active Connections:</strong> {profile.quickStats?.activeConnections}</p>
            <p><strong>Total Meters:</strong> {profile.quickStats?.totalMeters}</p>
            <p><strong>Unpaid Bills:</strong> {profile.quickStats?.unpaidBills}</p>
            <p><strong>Unpaid Amount:</strong> {Number(profile.quickStats?.unpaidAmount || 0).toFixed(2)}</p>
          </div>

          <DataTable
            title={`Connections for Consumer #${selectedId}`}
            rows={profile.connections || []}
            columns={[
              { key: "connection_id", label: "Connection ID" },
              { key: "service_type", label: "Service" },
              { key: "connection_status", label: "Status" },
              { key: "installation_address", label: "Address" }
            ]}
          />

          <DataTable
            title="Meters"
            rows={profile.meters || []}
            columns={[
              { key: "meter_id", label: "Meter ID" },
              { key: "meter_number", label: "Meter Number" },
              { key: "meter_status", label: "Status" },
              { key: "installation_date", label: "Install Date" }
            ]}
          />

          <DataTable
            title="Recent Reading Records"
            rows={profile.records || []}
            columns={[
              { key: "reading_id", label: "Reading ID" },
              { key: "meter_id", label: "Meter ID" },
              { key: "consumption_units", label: "Units" },
              { key: "reading_date", label: "Reading Date" }
            ]}
          />

          <DataTable
            title="Recent Bills"
            rows={profile.bills || []}
            columns={[
              { key: "bill_id", label: "Bill ID" },
              { key: "bill_number", label: "Bill Number" },
              { key: "total_amount", label: "Amount" },
              { key: "payment_status", label: "Status" },
              { key: "due_date", label: "Due Date" }
            ]}
          />

          <DataTable
            title="Recent Payments"
            rows={profile.payments || []}
            columns={[
              { key: "payment_id", label: "Payment ID" },
              { key: "bill_id", label: "Bill ID" },
              { key: "amount_paid", label: "Amount Paid" },
              { key: "payment_mode", label: "Mode" },
              { key: "payment_date", label: "Payment Date" }
            ]}
          />
        </div>
      )}
    </div>
  );
}

export default ConsumerSearch;
