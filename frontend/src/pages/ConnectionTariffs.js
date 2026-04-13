import { useEffect, useState } from "react";
import axios from "axios";

function ConnectionTariffs() {
  const [data, setData] = useState([]);
  const [connections, setConnections] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    connection_id: "",
    tariff_id: "",
    start_date: "",
    end_date: ""
  });

  useEffect(() => {
    fetchData();
    axios.get("http://127.0.0.1:5000/connections").then(res => setConnections(res.data));
    axios.get("http://127.0.0.1:5000/tariffs").then(res => setTariffs(res.data));
  }, []);

  const fetchData = () => {
    axios.get("http://127.0.0.1:5000/connection-tariffs")
      .then(res => setData(res.data));
  };

  const handleSubmit = async () => {
    try {
      if (editId) {
        await axios.put(`http://127.0.0.1:5000/connection-tariffs/${editId}`, form);
      } else {
        await axios.post("http://127.0.0.1:5000/connection-tariffs", form);
      }

      setEditId(null);
      setForm({
        connection_id: "",
        tariff_id: "",
        start_date: "",
        end_date: ""
      });

      fetchData();
    } catch (err) {
      console.log(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/connection-tariffs/${id}`);
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete connection tariff");
    }
  };

  return (
    <div>
      <h1>Connection Tariffs</h1>

      <select value={form.connection_id}
        onChange={e => setForm({...form, connection_id:e.target.value})}>
        <option value="">Select Connection</option>
        {connections.map(c => (
          <option key={c.connection_id} value={c.connection_id}>
            {c.connection_id}
          </option>
        ))}
      </select>

      <select value={form.tariff_id}
        onChange={e => setForm({...form, tariff_id:e.target.value})}>
        <option value="">Select Plan</option>
        {tariffs.map(t => (
          <option key={t.tariff_id} value={t.tariff_id}>
            {t.service_type} - {t.consumer_type}
          </option>
        ))}
      </select>

      <input type="date"
        value={form.start_date}
        onChange={e => setForm({...form, start_date:e.target.value})} />

      <input type="date"
        value={form.end_date}
        onChange={e => setForm({...form, end_date:e.target.value})} />

      <button onClick={handleSubmit}>
        {editId ? "Update" : "Add"}
      </button>

      <table border="1">
        <thead>
          <tr>
            <th>ID</th>
            <th>Connection</th>
            <th>Tariff</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.connection_tariff_id}>
              <td>{d.connection_tariff_id}</td>
              <td>{d.connection_id}</td>
              <td>{d.plan_name || d.tariff_id}</td>
              <td>{d.start_date?.split("T")[0]}</td>
              <td>{d.end_date ? d.end_date.split("T")[0] : "Active"}</td>
              <td>
                <button onClick={() => handleDelete(d.connection_tariff_id)}>Delete</button>

                <button onClick={() => {
                  setForm({
                    connection_id: d.connection_id,
                    tariff_id: d.tariff_id,
                    start_date: d.start_date?.split("T")[0] || "",
                    end_date: d.end_date?.split("T")[0] || ""
                  });
                  setEditId(d.connection_tariff_id);
                }}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ConnectionTariffs;