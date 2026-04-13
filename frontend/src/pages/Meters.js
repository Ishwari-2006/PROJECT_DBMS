import { useEffect, useState } from "react";
import axios from "axios";

function Meters() {
  const [data, setData] = useState([]);
  const [connections, setConnections] = useState([]);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    meter_number: "",
    installation_date: "",
    meter_status: "Active",
    connection_id: ""
  });

  useEffect(() => {
    fetchData();
    axios.get("http://127.0.0.1:5000/connections").then(res => setConnections(res.data));
  }, []);

  const fetchData = () => {
    axios.get("http://127.0.0.1:5000/meters").then(res => setData(res.data));
  };

  const handleSubmit = async () => {
    if (!form.meter_number || !form.installation_date || !form.meter_status || !form.connection_id) {
      alert("Please fill all meter fields.");
      return;
    }

    try {
      if (editId) {
        await axios.put(`http://127.0.0.1:5000/meters/${editId}`, form);
      } else {
        await axios.post("http://127.0.0.1:5000/meters", form);
      }

      setEditId(null);
      setForm({
        meter_number: "",
        installation_date: "",
        meter_status: "Active",
        connection_id: ""
      });
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save meter");
    }
  };

  return (
    <div>
      <h1>Meters</h1>

      <input placeholder="Meter Number"
        value={form.meter_number}
        onChange={e => setForm({...form, meter_number:e.target.value})} />

      <input type="date"
        value={form.installation_date}
        onChange={e => setForm({...form, installation_date:e.target.value})} />

      <select
        value={form.meter_status}
        onChange={e => setForm({...form, meter_status:e.target.value})}
      >
        <option>Active</option>
        <option>Inactive</option>
      </select>

      <select
        value={form.connection_id}
        onChange={e => setForm({...form, connection_id:e.target.value})}
      >
        <option value="">Select Connection</option>
        {connections.map(c => (
          <option key={c.connection_id} value={c.connection_id}>{c.connection_id}</option>
        ))}
      </select>

      <button onClick={handleSubmit}>{editId ? "Update" : "Add"}</button>

      <table border="1" cellPadding="10" style={{ marginTop: "20px" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Meter Number</th>
            <th>Installation Date</th>
            <th>Status</th>
            <th>Connection ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.meter_id}>
              <td>{d.meter_id}</td>
              <td>{d.meter_number}</td>
              <td>{d.installation_date ? d.installation_date.split("T")[0] : ""}</td>
              <td>{d.meter_status}</td>
              <td>{d.connection_id}</td>
              <td>
                <button
                  onClick={() => {
                    setForm({
                      meter_number: d.meter_number || "",
                      installation_date: d.installation_date?.split("T")[0] || "",
                      meter_status: d.meter_status || "Active",
                      connection_id: d.connection_id || ""
                    });
                    setEditId(d.meter_id);
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    try {
                      await axios.delete(`http://127.0.0.1:5000/meters/${d.meter_id}`);
                      fetchData();
                    } catch (err) {
                      alert(err?.response?.data?.message || "Failed to delete meter");
                    }
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Meters;