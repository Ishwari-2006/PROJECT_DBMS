import { useEffect, useState } from "react";
import axios from "axios";

function Consumers() {
  const [data, setData] = useState([]);
  const [form, setForm] = useState({
    name: "",
    address: "",
    contact_no: "",
    consumer_type: "Residential",
    registration_date: ""
  });
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    fetchConsumers();
  }, []);

  const fetchConsumers = () => {
    axios.get("http://127.0.0.1:5000/consumers")
      .then(res => setData(res.data))
      .catch(err => console.log(err));
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.address || !form.registration_date) {
      alert("Fill all fields");
      return;
    }

    try {
      if (editId) {
        await axios.put(`http://127.0.0.1:5000/consumers/${editId}`, form);
        console.log("Updated");
      } else {
        await axios.post("http://127.0.0.1:5000/consumers", form);
        console.log("Added");
      }

      // reset
      setEditId(null);
      setForm({
        name: "",
        address: "",
        contact_no: "",
        consumer_type: "Residential",
        registration_date: ""
      });

      fetchConsumers();

    } catch (err) {
      console.log("ERROR:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/consumers/${id}`);
      fetchConsumers();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete consumer");
    }
  };

  return (
    <div>
      <h1>Consumers</h1>

      {/* FORM */}
      <div style={{ marginBottom: "20px" }}>
        <input
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={handleChange}
        />
        <input
          name="address"
          placeholder="Address"
          value={form.address}
          onChange={handleChange}
        />
        <input
          name="contact_no"
          placeholder="Contact"
          value={form.contact_no}
          onChange={handleChange}
        />

        <select
          name="consumer_type"
          value={form.consumer_type}
          onChange={handleChange}
        >
          <option>Residential</option>
          <option>Commercial</option>
          <option>Industrial</option>
        </select>

        <input
          type="date"
          name="registration_date"
          value={form.registration_date}
          onChange={handleChange}
        />

        <button
          style={{ marginLeft: "10px" }}
          onClick={handleSubmit}
        >
          {editId ? "Update" : "Add"}
        </button>
      </div>

      {/* TABLE */}
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Address</th>
            <th>Contact</th>
            <th>Type</th>
            <th>Registration Date</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.map((c) => (
            <tr key={c.consumer_id}>
              <td>{c.consumer_id}</td>
              <td>{c.name}</td>
              <td>{c.address}</td>
              <td>{c.contact_no}</td>
              <td>{c.consumer_type}</td>
              <td>{c.registration_date ? c.registration_date.split("T")[0] : ""}</td>
              <td>
                <button onClick={() => handleDelete(c.consumer_id)}>
                  Delete
                </button>

                <button
                  onClick={() => {
                    setForm({
                      name: c.name,
                      address: c.address,
                      contact_no: c.contact_no,
                      consumer_type: c.consumer_type,
                      registration_date: c.registration_date?.split("T")[0]
                    });
                    setEditId(c.consumer_id);
                  }}
                  style={{ marginLeft: "10px" }}
                >
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

export default Consumers;