import { useEffect, useState } from "react";
import axios from "axios";
import TableControls from "../components/TableControls";
import Modal from "../components/Modal";
import TableSearch from "../components/TableSearch";

function Consumers() {
  const [data, setData] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [searchField, setSearchField] = useState("consumer_id");
  const [searchTerm, setSearchTerm] = useState("");
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
      .catch(() => setData([]));
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
      setShowForm(false);

      fetchConsumers();

    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save consumer");
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

  const handleEditById = (id) => {
    const consumer = data.find((c) => Number(c.consumer_id) === Number(id));
    if (!consumer) {
      alert("Consumer not found");
      return;
    }

    setForm({
      name: consumer.name,
      address: consumer.address,
      contact_no: consumer.contact_no,
      consumer_type: consumer.consumer_type,
      registration_date: consumer.registration_date?.split("T")[0] || ""
    });
    setEditId(consumer.consumer_id);
    setShowForm(true);
  };

  const handleDeleteById = async (id) => {
    const consumer = data.find((c) => Number(c.consumer_id) === Number(id));
    if (!consumer) {
      alert("Consumer not found");
      return;
    }
    await handleDelete(consumer.consumer_id);
  };

  const filteredData = data.filter((consumer) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return true;
    }

    const valueMap = {
      consumer_id: consumer.consumer_id,
      name: consumer.name
    };

    return String(valueMap[searchField] ?? "").toLowerCase().includes(term);
  });

  return (
    <div>
      <h1>Consumers</h1>

      <TableControls
        entityLabel="Consumer"
        onInsert={() => {
          setEditId(null);
          setForm({
            name: "",
            address: "",
            contact_no: "",
            consumer_type: "Residential",
            registration_date: ""
          });
          setShowForm(true);
        }}
        onEditById={handleEditById}
        onDeleteById={handleDeleteById}
      />

      <TableSearch
        title="Consumers"
        field={searchField}
        term={searchTerm}
        options={[
          { value: "consumer_id", label: "ID" },
          { value: "name", label: "Name" }
        ]}
        onFieldChange={setSearchField}
        onTermChange={setSearchTerm}
      />

      <Modal
        open={showForm}
        title={editId ? "Edit Consumer" : "Insert Consumer"}
        onClose={() => setShowForm(false)}
        footer={(
          <>
            <button type="button" className="modal-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="button" onClick={handleSubmit}>{editId ? "Update" : "Add"}</button>
          </>
        )}
      >
        <div className="modal-grid">
          <input
            className="full-span"
            name="name"
            placeholder="Name"
            value={form.name}
            onChange={handleChange}
          />
          <input
            className="full-span"
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
            className="full-span"
            type="date"
            name="registration_date"
            value={form.registration_date}
            onChange={handleChange}
          />
        </div>
      </Modal>

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
          </tr>
        </thead>

        <tbody>
          {filteredData.map((c) => (
            <tr key={c.consumer_id}>
              <td>{c.consumer_id}</td>
              <td>{c.name}</td>
              <td>{c.address}</td>
              <td>{c.contact_no}</td>
              <td>{c.consumer_type}</td>
              <td>{c.registration_date ? c.registration_date.split("T")[0] : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Consumers;