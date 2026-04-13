import { useEffect, useState } from "react";
import axios from "axios";

function Records() {
  const [meters, setMeters] = useState([]);
  const [form, setForm] = useState({});
  const [editId] = useState(null);

  useEffect(() => {
    axios.get("http://127.0.0.1:5000/meters").then(res => setMeters(res.data));
  }, []);

  const handleSubmit = async () => {
    if (editId) {
      await axios.put(`http://127.0.0.1:5000/records/${editId}`, form);
    } else {
      await axios.post("http://127.0.0.1:5000/records", form);
    }
    window.location.reload();
  };

  return (
    <div>
      <h1>Consumption</h1>

      <input placeholder="Previous" onChange={e=>setForm({...form, previous_reading:e.target.value})}/>
      <input placeholder="Current" onChange={e=>setForm({...form, current_reading:e.target.value})}/>
      <input placeholder="Units" onChange={e=>setForm({...form, consumption_units:e.target.value})}/>
      <input type="date" onChange={e=>setForm({...form, reading_date:e.target.value})}/>

      <select onChange={e=>setForm({...form, meter_id:e.target.value})}>
        {meters.map(m=> <option value={m.meter_id}>{m.meter_id}</option>)}
      </select>

      <button onClick={handleSubmit}>Save</button>
    </div>
  );
}

export default Records;