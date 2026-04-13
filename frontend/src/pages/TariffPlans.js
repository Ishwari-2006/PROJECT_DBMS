import { useEffect, useState } from "react";
import axios from "axios";

function TariffPlans() {
  const [data, setData] = useState([]);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    service_type: "Electricity",
    consumer_type: "Residential",
    rate_per_unit: "",
    fixed_charge: "",
    tax_percentage: "",
    effective_from: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    axios.get("http://127.0.0.1:5000/tariffs")
      .then(res => setData(res.data));
  };

  const handleSubmit = async () => {
    try {
      if (editId) {
        await axios.put(`http://127.0.0.1:5000/tariffs/${editId}`, form);
      } else {
        await axios.post("http://127.0.0.1:5000/tariffs", form);
      }

      setEditId(null);
      setForm({
        service_type: "Electricity",
        consumer_type: "Residential",
        rate_per_unit: "",
        fixed_charge: "",
        tax_percentage: "",
        effective_from: ""
      });

      fetchData();
    } catch (err) {
      console.log(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/tariffs/${id}`);
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete tariff");
    }
  };

  return (
    <div>
      <h1>Tariff Plans</h1>

      <select
        value={form.service_type}
        onChange={e => setForm({...form, service_type:e.target.value})}
      >
        <option>Electricity</option>
        <option>Water</option>
        <option>Gas</option>
      </select>

      <select
        value={form.consumer_type}
        onChange={e => setForm({...form, consumer_type:e.target.value})}
      >
        <option>Residential</option>
        <option>Commercial</option>
        <option>Industrial</option>
      </select>

      <input placeholder="Rate per Unit"
        value={form.rate_per_unit}
        onChange={e => setForm({...form, rate_per_unit:e.target.value})} />

      <input placeholder="Fixed Charge"
        value={form.fixed_charge}
        onChange={e => setForm({...form, fixed_charge:e.target.value})} />

      <input placeholder="Tax %"
        value={form.tax_percentage}
        onChange={e => setForm({...form, tax_percentage:e.target.value})} />

      <input type="date"
        value={form.effective_from}
        onChange={e => setForm({...form, effective_from:e.target.value})} />

      <button onClick={handleSubmit}>
        {editId ? "Update" : "Add"}
      </button>

      <table border="1">
        <thead>
          <tr>
            <th>ID</th>
            <th>Service</th>
            <th>Consumer Type</th>
            <th>Rate</th>
            <th>Charge</th>
            <th>Tax %</th>
            <th>Effective From</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {data.map(t => (
            <tr key={t.tariff_id}>
              <td>{t.tariff_id}</td>
              <td>{t.service_type}</td>
              <td>{t.consumer_type}</td>
              <td>{t.rate_per_unit}</td>
              <td>{t.fixed_charge}</td>
              <td>{t.tax_percentage}</td>
              <td>{t.effective_from ? t.effective_from.split("T")[0] : ""}</td>
              <td>
                <button onClick={() => handleDelete(t.tariff_id)}>Delete</button>

                <button onClick={() => {
                  setForm({
                    service_type: t.service_type,
                    consumer_type: t.consumer_type,
                    rate_per_unit: t.rate_per_unit,
                    fixed_charge: t.fixed_charge,
                    tax_percentage: t.tax_percentage,
                    effective_from: t.effective_from?.split("T")[0] || ""
                  });
                  setEditId(t.tariff_id);
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

export default TariffPlans;