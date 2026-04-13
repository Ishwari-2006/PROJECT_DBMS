console.log("🔥 THIS IS MY SERVER FILE");
const express = require("express");
const db = require("./db");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const dbQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });

const nextId = async (tableName, idColumn) => {
  const rows = await dbQuery(
    `SELECT COALESCE(MAX(${idColumn}), 0) + 1 AS next_id FROM ${tableName}`
  );
  return Number(rows[0].next_id);
};

const syncBillStatus = async (billId) => {
  const totals = await dbQuery(
    "SELECT COALESCE(SUM(amount_paid), 0) AS paid_total FROM Payment WHERE bill_id = ?",
    [billId]
  );
  const bills = await dbQuery("SELECT total_amount FROM Bill WHERE bill_id = ?", [billId]);

  if (!bills.length) {
    return;
  }

  const paidTotal = Number(totals[0].paid_total || 0);
  const totalAmount = Number(bills[0].total_amount || 0);
  let status = "Unpaid";
  if (paidTotal >= totalAmount && totalAmount > 0) {
    status = "Paid";
  } else if (paidTotal > 0 && paidTotal < totalAmount) {
    status = "Partial";
  }

  await dbQuery("UPDATE Bill SET payment_status = ? WHERE bill_id = ?", [status, billId]);
};

app.get("/", (req, res) => {
  res.send("Backend working");
});
app.get("/test", (req, res) => {
  res.send("TEST OK");
});

app.get("/dashboard/summary", async (req, res) => {
  try {
    const [consumers, activeConnections, activeMeters, pendingBills, revenue] = await Promise.all([
      dbQuery("SELECT COUNT(*) AS count FROM Consumer"),
      dbQuery("SELECT COUNT(*) AS count FROM Service_Connection WHERE connection_status = 'Active'"),
      dbQuery("SELECT COUNT(*) AS count FROM Meter WHERE meter_status = 'Active'"),
      dbQuery("SELECT COUNT(*) AS count FROM Bill WHERE payment_status = 'Unpaid'"),
      dbQuery("SELECT COALESCE(SUM(amount_paid), 0) AS total FROM Payment")
    ]);

    res.json({
      consumers: consumers[0].count,
      activeConnections: activeConnections[0].count,
      activeMeters: activeMeters[0].count,
      pendingBills: pendingBills[0].count,
      totalRevenue: Number(revenue[0].total || 0)
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dashboard summary", error: error.message });
  }
});

//////////////////////////////////////////////////////
// ✅ CONSUMERS
//////////////////////////////////////////////////////

app.get("/consumers", (req, res) => {
  db.query("SELECT * FROM Consumer", (err, result) => {
    if (err) return res.send(err);
    res.json(result);
  });
});

app.post("/consumers", (req, res) => {
  const { name, address, contact_no, consumer_type, registration_date } = req.body;
  nextId("Consumer", "consumer_id")
    .then((consumer_id) => {
      db.query(
        "INSERT INTO Consumer (consumer_id, name, address, contact_no, consumer_type, registration_date) VALUES (?, ?, ?, ?, ?, ?)",
        [consumer_id, name, address, contact_no, consumer_type, registration_date],
        (err) => {
          if (err) return res.status(500).json({ message: "Failed to add consumer", error: err.message });
          res.status(201).json({ message: "Consumer Added", consumer_id });
        }
      );
    })
    .catch((error) => res.status(500).json({ message: "Failed to add consumer", error: error.message }));
});

app.put("/consumers/:id", (req, res) => {
  const { name, address, contact_no, consumer_type } = req.body;

  db.query(
    "UPDATE Consumer SET name=?, address=?, contact_no=?, consumer_type=? WHERE consumer_id=?",
    [name, address, contact_no, consumer_type, req.params.id],
    (err) => {
      if (err) return res.send(err);
      res.send("Consumer Updated");
    }
  );
});

app.delete("/consumers/:id", (req, res) => {
  db.query(
    "DELETE FROM Consumer WHERE consumer_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete consumer", error: err.message });
      res.send("Consumer Deleted");
    }
  );
});

//////////////////////////////////////////////////////
// ✅ SERVICE CONNECTIONS
//////////////////////////////////////////////////////

app.get("/connections", (req, res) => {
  db.query("SELECT * FROM Service_Connection", (err, result) => {
    if (err) return res.send(err);
    res.json(result);
  });
});

app.post("/connections", (req, res) => {
  const { service_type, installation_address, connection_status, consumer_id } = req.body;
  nextId("Service_Connection", "connection_id")
    .then((connection_id) => {
      db.query(
        "INSERT INTO Service_Connection (connection_id, service_type, installation_address, connection_status, consumer_id) VALUES (?, ?, ?, ?, ?)",
        [connection_id, service_type, installation_address, connection_status, consumer_id],
        (err) => {
          if (err) return res.status(500).json({ message: "Failed to add connection", error: err.message });
          res.status(201).json({ message: "Connection Added", connection_id });
        }
      );
    })
    .catch((error) => res.status(500).json({ message: "Failed to add connection", error: error.message }));
});

app.put("/connections/:id", (req, res) => {
  const { service_type, installation_address, connection_status, consumer_id } = req.body;

  db.query(
    "UPDATE Service_Connection SET service_type=?, installation_address=?, connection_status=?, consumer_id=? WHERE connection_id=?",
    [service_type, installation_address, connection_status, consumer_id, req.params.id],
    (err) => {
      if (err) return res.send(err);
      res.send("Connection Updated");
    }
  );
});

app.delete("/connections/:id", (req, res) => {
  db.query(
    "DELETE FROM Service_Connection WHERE connection_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete connection", error: err.message });
      res.send("Connection Deleted");
    }
  );
});

//////////////////////////////////////////////////////
// ✅ METERS
//////////////////////////////////////////////////////

app.get("/meters", (req, res) => {
  db.query("SELECT * FROM Meter", (err, result) => {
    if (err) return res.send(err);
    res.json(result);
  });
});

app.post("/meters", (req, res) => {
  const { meter_number, installation_date, meter_status, connection_id } = req.body;

  if (!meter_number || !installation_date || !meter_status || !connection_id) {
    return res.status(400).json({ message: "All meter fields are required" });
  }

  nextId("Meter", "meter_id")
    .then((meter_id) => {
      db.query(
        "INSERT INTO Meter (meter_id, meter_number, installation_date, meter_status, connection_id) VALUES (?, ?, ?, ?, ?)",
        [meter_id, meter_number, installation_date, meter_status, connection_id],
        (err) => {
          if (err) {
            if (err.code === "ER_DUP_ENTRY") {
              return res.status(400).json({
                message: "Meter number already exists or this connection already has a meter"
              });
            }
            if (err.code === "ER_NO_REFERENCED_ROW_2") {
              return res.status(400).json({ message: "Invalid connection selected" });
            }
            return res.status(500).json({ message: "Failed to add meter", error: err.message });
          }
          res.status(201).json({ message: "Meter Added", meter_id });
        }
      );
    })
    .catch((error) => res.status(500).json({ message: "Failed to add meter", error: error.message }));
});

app.put("/meters/:id", (req, res) => {
  const { meter_number, installation_date, meter_status, connection_id } = req.body;

  if (!meter_number || !installation_date || !meter_status || !connection_id) {
    return res.status(400).json({ message: "All meter fields are required" });
  }

  db.query(
    "UPDATE Meter SET meter_number=?, installation_date=?, meter_status=?, connection_id=? WHERE meter_id=?",
    [meter_number, installation_date, meter_status, connection_id, req.params.id],
    (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({
            message: "Meter number already exists or this connection already has a meter"
          });
        }
        if (err.code === "ER_NO_REFERENCED_ROW_2") {
          return res.status(400).json({ message: "Invalid connection selected" });
        }
        return res.status(500).json({ message: "Failed to update meter", error: err.message });
      }
      res.send("Meter Updated");
    }
  );
});

app.delete("/meters/:id", (req, res) => {
  db.query(
    "DELETE FROM Meter WHERE meter_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete meter", error: err.message });
      res.send("Meter Deleted");
    }
  );
});

//////////////////////////////////////////////////////
// ✅ RECORDS
//////////////////////////////////////////////////////

app.get("/records", (req, res) => {
  db.query("SELECT * FROM Consumption_Record", (err, result) => {
    if (err) return res.send(err);
    res.json(result);
  });
});

app.post("/records", (req, res) => {
  const { previous_reading, current_reading, reading_date, meter_id } = req.body;
  const consumption_units = Number(current_reading || 0) - Number(previous_reading || 0);

  if (consumption_units < 0) {
    return res.status(400).json({ message: "Current reading must be greater than or equal to previous reading" });
  }

  nextId("Consumption_Record", "reading_id")
    .then((reading_id) => {
      db.query(
        "INSERT INTO Consumption_Record (reading_id, previous_reading, current_reading, consumption_units, reading_date, meter_id) VALUES (?, ?, ?, ?, ?, ?)",
        [reading_id, previous_reading, current_reading, consumption_units, reading_date, meter_id],
        (err) => {
          if (err) return res.status(500).json({ message: "Failed to add record", error: err.message });
          res.status(201).json({ message: "Record Added", reading_id });
        }
      );
    })
    .catch((error) => res.status(500).json({ message: "Failed to add record", error: error.message }));
});

app.put("/records/:id", (req, res) => {
  const { previous_reading, current_reading, reading_date, meter_id } = req.body;
  const consumption_units = Number(current_reading || 0) - Number(previous_reading || 0);

  if (consumption_units < 0) {
    return res.status(400).json({ message: "Current reading must be greater than or equal to previous reading" });
  }

  db.query(
    "UPDATE Consumption_Record SET previous_reading=?, current_reading=?, consumption_units=?, reading_date=?, meter_id=? WHERE reading_id=?",
    [previous_reading, current_reading, consumption_units, reading_date, meter_id, req.params.id],
    (err) => {
      if (err) return res.send(err);
      res.send("Record Updated");
    }
  );
});

app.delete("/records/:id", (req, res) => {
  db.query(
    "DELETE FROM Consumption_Record WHERE reading_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete record", error: err.message });
      res.send("Record Deleted");
    }
  );
});

//////////////////////////////////////////////////////
// ✅ BILLS
//////////////////////////////////////////////////////

app.get("/bills", (req, res) => {
  console.log("✅ /bills route hit");
  db.query("SELECT * FROM Bill", (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.send(err);
    }
    res.json(result);
  });
});

app.post("/bills", (req, res) => {
  const { bill_number, billing_period, total_amount, due_date, payment_status, connection_id, reading_id } = req.body;
  nextId("Bill", "bill_id")
    .then((bill_id) => {
      db.query(
        "INSERT INTO Bill (bill_id, bill_number, billing_period, total_amount, due_date, payment_status, connection_id, reading_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [bill_id, bill_number, billing_period, total_amount, due_date, payment_status, connection_id, reading_id],
        (err) => {
          if (err) return res.status(500).json({ message: "Failed to add bill", error: err.message });
          res.status(201).json({ message: "Bill Added", bill_id });
        }
      );
    })
    .catch((error) => res.status(500).json({ message: "Failed to add bill", error: error.message }));
});

app.post("/bills/generate", async (req, res) => {
  const { bill_number, billing_period, due_date, connection_id, reading_id } = req.body;

  if (!bill_number || !connection_id || !reading_id || !due_date) {
    return res.status(400).json({ message: "bill_number, connection_id, reading_id and due_date are required" });
  }

  try {
    const readingRows = await dbQuery(
      "SELECT consumption_units FROM Consumption_Record WHERE reading_id = ?",
      [reading_id]
    );

    if (!readingRows.length) {
      return res.status(404).json({ message: "Consumption record not found" });
    }

    const tariffRows = await dbQuery(
      `SELECT tp.rate_per_unit, tp.fixed_charge, tp.tax_percentage
       FROM Connection_Tariff ct
       JOIN Tariff_Plan tp ON tp.tariff_id = ct.tariff_id
       WHERE ct.connection_id = ?
       ORDER BY ct.start_date DESC
       LIMIT 1`,
      [connection_id]
    );

    if (!tariffRows.length) {
      return res.status(404).json({ message: "No tariff plan assigned to this connection" });
    }

    const units = Number(readingRows[0].consumption_units || 0);
    const ratePerUnit = Number(tariffRows[0].rate_per_unit || 0);
    const fixedCharge = Number(tariffRows[0].fixed_charge || 0);
    const taxPercentage = Number(tariffRows[0].tax_percentage || 0);
    const subtotal = units * ratePerUnit + fixedCharge;
    const totalAmount = Number((subtotal + (subtotal * taxPercentage) / 100).toFixed(2));

    const bill_id = await nextId("Bill", "bill_id");
    await dbQuery(
      `INSERT INTO Bill (bill_id, bill_number, billing_period, total_amount, due_date, payment_status, connection_id, reading_id)
       VALUES (?, ?, ?, ?, ?, 'Unpaid', ?, ?)`,
      [bill_id, bill_number, billing_period || null, totalAmount, due_date, connection_id, reading_id]
    );

    const newBill = await dbQuery("SELECT * FROM Bill WHERE bill_id = ?", [bill_id]);
    res.status(201).json(newBill[0]);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate bill", error: error.message });
  }
});

app.put("/bills/:id", (req, res) => {
  const { bill_number, billing_period, total_amount, due_date, payment_status, connection_id, reading_id } = req.body;

  db.query(
    "UPDATE Bill SET bill_number=?, billing_period=?, total_amount=?, due_date=?, payment_status=?, connection_id=?, reading_id=? WHERE bill_id=?",
    [bill_number, billing_period, total_amount, due_date, payment_status, connection_id, reading_id, req.params.id],
    (err) => {
      if (err) return res.send(err);
      res.send("Bill Updated");
    }
  );
});

app.delete("/bills/:id", (req, res) => {
  db.query(
    "DELETE FROM Bill WHERE bill_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete bill", error: err.message });
      res.send("Bill Deleted");
    }
  );
});

//////////////////////////////////////////////////////
// ✅ PAYMENTS
//////////////////////////////////////////////////////

app.get("/payments", (req, res) => {
  db.query("SELECT * FROM Payment", (err, result) => {
    if (err) return res.send(err);
    res.json(result);
  });
});

app.post("/payments", async (req, res) => {
  const { payment_date, amount_paid, payment_mode, bill_id } = req.body;

  try {
    const payment_id = await nextId("Payment", "payment_id");
    await dbQuery(
      "INSERT INTO Payment (payment_id, payment_date, amount_paid, payment_mode, bill_id) VALUES (?, ?, ?, ?, ?)",
      [payment_id, payment_date, amount_paid, payment_mode, bill_id]
    );
    await syncBillStatus(bill_id);
    res.status(201).json({ payment_id, message: "Payment Added" });
  } catch (error) {
    res.status(500).json({ message: "Failed to add payment", error: error.message });
  }
});

app.put("/payments/:id", async (req, res) => {
  const { payment_date, amount_paid, payment_mode, bill_id } = req.body;
  try {
    const existing = await dbQuery("SELECT bill_id FROM Payment WHERE payment_id = ?", [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ message: "Payment not found" });
    }

    await dbQuery(
      "UPDATE Payment SET payment_date=?, amount_paid=?, payment_mode=?, bill_id=? WHERE payment_id=?",
      [payment_date, amount_paid, payment_mode, bill_id, req.params.id]
    );

    await syncBillStatus(existing[0].bill_id);
    if (Number(existing[0].bill_id) !== Number(bill_id)) {
      await syncBillStatus(bill_id);
    }

    res.json({ message: "Payment Updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update payment", error: error.message });
  }
});

app.delete("/payments/:id", async (req, res) => {
  try {
    const existing = await dbQuery("SELECT bill_id FROM Payment WHERE payment_id = ?", [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ message: "Payment not found" });
    }

    await dbQuery("DELETE FROM Payment WHERE payment_id=?", [req.params.id]);
    await syncBillStatus(existing[0].bill_id);
    res.json({ message: "Payment Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete payment", error: error.message });
  }
});

//////////////////////////////////////////////////////
// ✅ TARIFF PLANS
//////////////////////////////////////////////////////

app.get("/tariffs", (req, res) => {
  db.query(
    `SELECT
      tariff_id,
      tariff_id AS plan_id,
      CONCAT(service_type, ' - ', consumer_type) AS plan_name,
      service_type,
      consumer_type,
      rate_per_unit,
      fixed_charge,
      tax_percentage,
      effective_from
     FROM Tariff_Plan
     ORDER BY tariff_id DESC`,
    (err, result) => {
    if (err) return res.send(err);
    res.json(result);
    }
  );
});

app.post("/tariffs", async (req, res) => {
  const {
    service_type = "Electricity",
    consumer_type = "Residential",
    rate_per_unit,
    fixed_charge,
    tax_percentage = 0,
    effective_from
  } = req.body;

  try {
    const tariff_id = await nextId("Tariff_Plan", "tariff_id");
    await dbQuery(
      `INSERT INTO Tariff_Plan
      (tariff_id, service_type, consumer_type, rate_per_unit, fixed_charge, tax_percentage, effective_from)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tariff_id,
        service_type,
        consumer_type,
        rate_per_unit,
        fixed_charge,
        tax_percentage,
        effective_from || null
      ]
    );
    res.status(201).json({ message: "Tariff Added", tariff_id });
  } catch (error) {
    res.status(500).json({ message: "Failed to add tariff", error: error.message });
  }
});

app.put("/tariffs/:id", async (req, res) => {
  const {
    service_type,
    consumer_type,
    rate_per_unit,
    fixed_charge,
    tax_percentage,
    effective_from
  } = req.body;

  try {
    await dbQuery(
      `UPDATE Tariff_Plan
       SET service_type=?, consumer_type=?, rate_per_unit=?, fixed_charge=?, tax_percentage=?, effective_from=?
       WHERE tariff_id=?`,
      [
        service_type,
        consumer_type,
        rate_per_unit,
        fixed_charge,
        tax_percentage,
        effective_from || null,
        req.params.id
      ]
    );
    res.json({ message: "Tariff Updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update tariff", error: error.message });
  }
});

app.delete("/tariffs/:id", (req, res) => {
  db.query(
    "DELETE FROM Tariff_Plan WHERE tariff_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete tariff", error: err.message });
      res.send("Tariff Deleted");
    }
  );
});

//////////////////////////////////////////////////////
// ✅ CONNECTION TARIFF
//////////////////////////////////////////////////////

app.get("/connection-tariffs", (req, res) => {
  db.query(
    `SELECT
      ct.connection_tariff_id,
      ct.connection_id,
      ct.tariff_id,
      ct.tariff_id AS plan_id,
      ct.start_date,
      ct.start_date AS effective_from,
      ct.end_date,
      CONCAT(tp.service_type, ' - ', tp.consumer_type) AS plan_name
     FROM Connection_Tariff ct
     LEFT JOIN Tariff_Plan tp ON tp.tariff_id = ct.tariff_id
     ORDER BY ct.connection_tariff_id DESC`,
    (err, result) => {
    if (err) return res.send(err);
    res.json(result);
    }
  );
});

app.post("/connection-tariffs", async (req, res) => {
  const { connection_id, plan_id, tariff_id, effective_from, start_date, end_date } = req.body;

  try {
    const connection_tariff_id = await nextId("Connection_Tariff", "connection_tariff_id");
    await dbQuery(
      `INSERT INTO Connection_Tariff (connection_tariff_id, start_date, end_date, connection_id, tariff_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        connection_tariff_id,
        start_date || effective_from || null,
        end_date || null,
        connection_id,
        tariff_id || plan_id
      ]
    );
    res.status(201).json({ message: "Connection Tariff Added", connection_tariff_id });
  } catch (error) {
    res.status(500).json({ message: "Failed to add connection tariff", error: error.message });
  }
});

app.put("/connection-tariffs/:id", async (req, res) => {
  const { connection_id, plan_id, tariff_id, effective_from, start_date, end_date } = req.body;

  try {
    await dbQuery(
      `UPDATE Connection_Tariff
       SET connection_id=?, tariff_id=?, start_date=?, end_date=?
       WHERE connection_tariff_id=?`,
      [
        connection_id,
        tariff_id || plan_id,
        start_date || effective_from || null,
        end_date || null,
        req.params.id
      ]
    );
    res.json({ message: "Connection Tariff Updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update connection tariff", error: error.message });
  }
});

app.delete("/connection-tariffs/:id", (req, res) => {
  db.query(
    "DELETE FROM Connection_Tariff WHERE connection_tariff_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete connection tariff", error: err.message });
      res.send("Connection Tariff Deleted");
    }
  );
});

//////////////////////////////////////////////////////

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});