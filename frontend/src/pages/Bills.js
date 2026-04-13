import { useEffect, useState } from "react";
import axios from "axios";

function Bills() {
  const [data, setData] = useState([]);
  const [connections, setConnections] = useState([]);
  const [records, setRecords] = useState([]);

  const [form, setForm] = useState({
    bill_number: "",
    billing_period: "",
    total_amount: "",
    due_date: "",
    payment_status: "Unpaid",
    connection_id: "",
    reading_id: ""
  });

  const [editId, setEditId] = useState(null);

  // FETCH DATA
  useEffect(() => {
    fetchBills();
    fetchConnections();
    fetchRecords();
  }, []);

  const fetchBills = () => {
    axios.get("http://127.0.0.1:5000/bills")
      .then(res => setData(res.data))
      .catch(err => console.log(err));
  };

  const fetchConnections = () => {
    axios.get("http://127.0.0.1:5000/connections")
      .then(res => setConnections(res.data))
      .catch(err => console.log(err));
  };

  const fetchRecords = () => {
    axios.get("http://127.0.0.1:5000/records")
      .then(res => setRecords(res.data))
      .catch(err => console.log(err));
  };

  // HANDLE INPUT
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ADD / UPDATE
  const handleSubmit = async () => {
    if (
      !form.bill_number ||
      !form.total_amount ||
      !form.connection_id ||
      !form.reading_id
    ) {
      alert("Fill required fields");
      return;
    }

    try {
      if (editId) {
        await axios.put(`http://127.0.0.1:5000/bills/${editId}`, form);
        console.log("Updated");
      } else {
        await axios.post("http://127.0.0.1:5000/bills", form);
        console.log("Added");
      }

      // RESET
      setEditId(null);
      setForm({
        bill_number: "",
        billing_period: "",
        total_amount: "",
        due_date: "",
        payment_status: "Unpaid",
        connection_id: "",
        reading_id: ""
      });

      fetchBills();

    } catch (err) {
      console.log("ERROR:", err);
    }
  };

  const handleGenerateBill = async () => {
    if (!form.bill_number || !form.connection_id || !form.reading_id || !form.due_date) {
      alert("Bill number, due date, connection and record are required to auto-generate.");
      return;
    }

    try {
      await axios.post("http://127.0.0.1:5000/bills/generate", {
        bill_number: form.bill_number,
        billing_period: form.billing_period,
        due_date: form.due_date,
        connection_id: form.connection_id,
        reading_id: form.reading_id
      });

      setEditId(null);
      setForm({
        bill_number: "",
        billing_period: "",
        total_amount: "",
        due_date: "",
        payment_status: "Unpaid",
        connection_id: "",
        reading_id: ""
      });
      fetchBills();
      alert("Bill generated from tariff plan successfully");
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to generate bill");
    }
  };

  // DELETE
  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/bills/${id}`);
      fetchBills();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete bill");
    }
  };

  return (
    <div>
      <h1>Bills</h1>

      {/* FORM */}
      <div style={{ marginBottom: "20px" }}>

        <input
          name="bill_number"
          placeholder="Bill Number"
          value={form.bill_number}
          onChange={handleChange}
        />

        <input
          name="billing_period"
          placeholder="Billing Period"
          value={form.billing_period}
          onChange={handleChange}
        />

        <input
          name="total_amount"
          placeholder="Total Amount"
          value={form.total_amount}
          onChange={handleChange}
        />

        <input
          type="date"
          name="due_date"
          value={form.due_date}
          onChange={handleChange}
        />

        <select
          name="payment_status"
          value={form.payment_status}
          onChange={handleChange}
        >
          <option>Unpaid</option>
          <option>Partial</option>
          <option>Paid</option>
        </select>

        {/* CONNECTION DROPDOWN */}
        <select
          name="connection_id"
          value={form.connection_id}
          onChange={handleChange}
        >
          <option value="">Select Connection</option>
          {connections.map(c => (
            <option key={c.connection_id} value={c.connection_id}>
              {c.connection_id}
            </option>
          ))}
        </select>

        {/* RECORD DROPDOWN */}
        <select
          name="reading_id"
          value={form.reading_id}
          onChange={handleChange}
        >
          <option value="">Select Record</option>
          {records.map(r => (
            <option key={r.reading_id} value={r.reading_id}>
              {r.reading_id}
            </option>
          ))}
        </select>

        <button
          style={{ marginLeft: "10px" }}
          onClick={handleSubmit}
        >
          {editId ? "Update" : "Add"}
        </button>

        {!editId && (
          <button
            style={{ marginLeft: "10px" }}
            onClick={handleGenerateBill}
          >
            Generate Auto Amount
          </button>
        )}

      </div>

      {/* TABLE */}
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>ID</th>
            <th>Bill No</th>
            <th>Billing Period</th>
            <th>Amount</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Connection</th>
            <th>Record</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {data.map(b => (
            <tr key={b.bill_id}>
              <td>{b.bill_id}</td>
              <td>{b.bill_number}</td>
              <td>{b.billing_period}</td>
              <td>{b.total_amount}</td>
              <td>{b.due_date ? b.due_date.split("T")[0] : ""}</td>
              <td>{b.payment_status}</td>
              <td>{b.connection_id}</td>
              <td>{b.reading_id}</td>

              <td>
                <button onClick={() => handleDelete(b.bill_id)}>
                  Delete
                </button>

                <button
                  onClick={() => {
                    setForm({
                      bill_number: b.bill_number,
                      billing_period: b.billing_period,
                      total_amount: b.total_amount,
                      due_date: b.due_date?.split("T")[0],
                      payment_status: b.payment_status,
                      connection_id: b.connection_id,
                      reading_id: b.reading_id
                    });
                    setEditId(b.bill_id);
                  }}
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

export default Bills;