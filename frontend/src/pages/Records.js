import { useEffect, useState } from "react";
import axios from "axios";

function Records() {
  const [data, setData] = useState([]);
  const [meters, setMeters] = useState([]);

  const [form, setForm] = useState({
    meter_id: "",
    reading_date: "",
    previous_reading: "",
    current_reading: ""
  });

  const [editId, setEditId] = useState(null);

  // FETCH DATA
  useEffect(() => {
    fetchRecords();
    axios
      .get("http://127.0.0.1:5000/meters")
      .then((res) => setMeters(res.data))
      .catch((err) => console.log(err));
  }, []);

  const fetchRecords = () => {
    axios
      .get("http://127.0.0.1:5000/records")
      .then((res) => setData(res.data))
      .catch((err) => console.log(err));
  };

  // HANDLE INPUT
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ADD / UPDATE
  const handleSubmit = async () => {
    if (
      !form.meter_id ||
      !form.reading_date ||
      form.previous_reading === "" ||
      form.current_reading === ""
    ) {
      alert("Fill all fields");
      return;
    }

    try {
      if (editId) {
        await axios.put(
          `http://127.0.0.1:5000/records/${editId}`,
          form
        );
        console.log("Updated");
      } else {
        await axios.post(
          "http://127.0.0.1:5000/records",
          form
        );
        console.log("Added");
      }

      // RESET
      setEditId(null);
      setForm({
        meter_id: "",
        reading_date: "",
        previous_reading: "",
        current_reading: ""
      });

      fetchRecords();

    } catch (err) {
      console.log("ERROR:", err);
    }
  };

  // DELETE
  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/records/${id}`);
      fetchRecords();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete record");
    }
  };

  return (
    <div>
      <h1>Records</h1>

      {/* FORM */}
      <div style={{ marginBottom: "20px" }}>
        <select
          name="meter_id"
          value={form.meter_id}
          onChange={handleChange}
        >
          <option value="">Select Meter</option>
          {meters.map((m) => (
            <option key={m.meter_id} value={m.meter_id}>
              {m.meter_id} - {m.meter_number}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="reading_date"
          value={form.reading_date}
          onChange={handleChange}
        />

        <input
          name="previous_reading"
          placeholder="Previous Reading"
          value={form.previous_reading}
          onChange={handleChange}
        />

        <input
          name="current_reading"
          placeholder="Current Reading"
          value={form.current_reading}
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
            <th>Meter ID</th>
            <th>Date</th>
            <th>Previous</th>
            <th>Current</th>
            <th>Units</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {data.map((r) => (
            <tr key={r.reading_id}>
              <td>{r.reading_id}</td>
              <td>{r.meter_id}</td>
              <td>
                {r.reading_date
                  ? r.reading_date.split("T")[0]
                  : ""}
              </td>
              <td>{r.previous_reading}</td>
              <td>{r.current_reading}</td>
              <td>{r.consumption_units}</td>

              <td>
                <button
                  onClick={() => handleDelete(r.reading_id)}
                >
                  Delete
                </button>

                <button
                  onClick={() => {
                    setForm({
                      meter_id: r.meter_id,
                      reading_date: r.reading_date?.split("T")[0],
                      previous_reading: r.previous_reading,
                      current_reading: r.current_reading
                    });
                    setEditId(r.reading_id);
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

export default Records;