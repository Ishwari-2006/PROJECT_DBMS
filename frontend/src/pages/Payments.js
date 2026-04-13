import { useEffect, useState } from "react";
import axios from "axios";

function Payments() {
  const [data, setData] = useState([]);
  const [bills, setBills] = useState([]);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    payment_date: "",
    amount_paid: "",
    payment_mode: "Cash",
    bill_id: ""
  });

  const fetchData = () => {
    axios.get("http://127.0.0.1:5000/payments").then((res) => setData(res.data));
    axios.get("http://127.0.0.1:5000/bills").then((res) => setBills(res.data));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!form.payment_date || !form.amount_paid || !form.bill_id) {
      alert("Fill all required fields");
      return;
    }

    if (editId) {
      await axios.put(`http://127.0.0.1:5000/payments/${editId}`, form);
    } else {
      await axios.post("http://127.0.0.1:5000/payments", form);
    }

    setEditId(null);
    setForm({
      payment_date: "",
      amount_paid: "",
      payment_mode: "Cash",
      bill_id: ""
    });
    fetchData();
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/payments/${id}`);
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete payment");
    }
  };

  return (
    <div>
      <h1>Payments</h1>

      <input
        type="date"
        value={form.payment_date}
        onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
      />
      <input
        placeholder="Amount"
        value={form.amount_paid}
        onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
      />

      <select
        value={form.payment_mode}
        onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
      >
        <option value="Cash">Cash</option>
        <option value="UPI">UPI</option>
        <option value="Card">Card</option>
        <option value="NetBanking">Net Banking</option>
      </select>

      <select
        value={form.bill_id}
        onChange={(e) => setForm({ ...form, bill_id: e.target.value })}
      >
        <option value="">Select Bill</option>
        {bills.map((b) => (
          <option key={b.bill_id} value={b.bill_id}>
            {b.bill_id} - {b.bill_number} ({b.payment_status})
          </option>
        ))}
      </select>

      <button onClick={handleSubmit}>{editId ? "Update" : "Add"}</button>

      <table border="1" cellPadding="10" style={{ marginTop: "20px" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Mode</th>
            <th>Bill ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.payment_id}>
              <td>{p.payment_id}</td>
              <td>{p.payment_date?.split("T")[0]}</td>
              <td>{p.amount_paid}</td>
              <td>{p.payment_mode}</td>
              <td>{p.bill_id}</td>
              <td>
                <button
                  onClick={() => {
                    setForm({
                      payment_date: p.payment_date?.split("T")[0],
                      amount_paid: p.amount_paid,
                      payment_mode: p.payment_mode || "Cash",
                      bill_id: String(p.bill_id)
                    });
                    setEditId(p.payment_id);
                  }}
                >
                  Edit
                </button>
                <button onClick={() => handleDelete(p.payment_id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Payments;