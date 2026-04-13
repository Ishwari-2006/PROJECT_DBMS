import { useEffect, useState } from "react";
import axios from "axios";

function ServiceConnections() {
  const [data, setData] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    service_type: "Electricity",
    installation_address: "",
    connection_status: "Active",
    consumer_id: ""
  });

  useEffect(() => {
    fetchData();
    fetchConsumers();
  }, []);

  const fetchData = () => {
    axios.get("http://127.0.0.1:5000/connections").then(res => setData(res.data));
  };

  const fetchConsumers = () => {
    axios.get("http://127.0.0.1:5000/consumers").then(res => setConsumers(res.data));
  };

  const getConsumerName = (consumerId) => {
    const consumer = consumers.find((c) => Number(c.consumer_id) === Number(consumerId));
    return consumer ? consumer.name : "-";
  };

  const handleSubmit = async () => {
    try {
      if (editId) {
        await axios.put(`http://127.0.0.1:5000/connections/${editId}`, form);
      } else {
        await axios.post("http://127.0.0.1:5000/connections", form);
      }

      setEditId(null);
      setForm({
        service_type: "Electricity",
        installation_address: "",
        connection_status: "Active",
        consumer_id: ""
      });

      fetchData();
    } catch (err) {
      console.log(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/connections/${id}`);
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete connection");
    }
  };

  return (
    <div>
      <h1>Service Connections</h1>

      <select value={form.service_type} onChange={e => setForm({...form, service_type:e.target.value})}>
        <option>Electricity</option>
        <option>Water</option>
        <option>Gas</option>
      </select>

      <input placeholder="Address" value={form.installation_address}
        onChange={e => setForm({...form, installation_address:e.target.value})} />

      <select value={form.connection_status}
        onChange={e => setForm({...form, connection_status:e.target.value})}>
        <option>Active</option>
        <option>Disconnected</option>
      </select>

      <select value={form.consumer_id}
        onChange={e => setForm({...form, consumer_id:e.target.value})}>
        <option value="">Select Consumer</option>
        {consumers.map(c => (
          <option key={c.consumer_id} value={c.consumer_id}>
            {c.consumer_id} - {c.name}
          </option>
        ))}
      </select>

      <button onClick={handleSubmit}>
        {editId ? "Update" : "Add"}
      </button>

      <table border="1">
        <thead>
          <tr>
            <th>ID</th>
            <th>Service Type</th>
            <th>Installation Address</th>
            <th>Status</th>
            <th>Consumer ID</th>
            <th>Consumer Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.connection_id}>
              <td>{d.connection_id}</td>
              <td>{d.service_type}</td>
              <td>{d.installation_address}</td>
              <td>{d.connection_status}</td>
              <td>{d.consumer_id}</td>
              <td>{getConsumerName(d.consumer_id)}</td>
              <td>
                <button onClick={() => handleDelete(d.connection_id)}>Delete</button>
                <button onClick={() => {
                  setForm(d);
                  setEditId(d.connection_id);
                }}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ServiceConnections;