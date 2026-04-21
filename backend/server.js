console.log("🔥 THIS IS MY SERVER FILE");
const express = require("express");
const db = require("./db");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

const sendError = (res, message, err, status = 500) =>
  res.status(status).json({ message, error: err?.message || err });

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

let readingTableCache = null;
const getReadingTableName = async () => {
  if (readingTableCache) {
    return readingTableCache;
  }

  const modern = await dbQuery("SHOW TABLES LIKE 'Reading_Record'");
  if (modern.length) {
    readingTableCache = "Reading_Record";
    return readingTableCache;
  }

  const legacy = await dbQuery("SHOW TABLES LIKE 'Consumption_Record'");
  if (legacy.length) {
    readingTableCache = "Consumption_Record";
    return readingTableCache;
  }

  throw new Error("Reading record table not found");
};

const normalizeSqlDate = (value) => {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const monthMap = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12"
  };

  const shortMonthMatch = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (shortMonthMatch) {
    const [, day, monthName, year] = shortMonthMatch;
    const month = monthMap[monthName.toLowerCase()];
    if (!month) {
      return null;
    }
    return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  return null;
};

const ALLOWED_DEPARTMENTS = ["Electricity", "Gas", "Water"];

const normalizeDepartment = (value) => {
  if (!value) {
    return null;
  }

  const raw = String(value).trim().toLowerCase();
  const match = ALLOWED_DEPARTMENTS.find((department) => department.toLowerCase() === raw);
  return match || null;
};

const getDepartmentFromRequest = (req) => normalizeDepartment(req.headers["x-department"]);

const requireDepartment = (req, res) => {
  const department = getDepartmentFromRequest(req);
  if (!department) {
    res.status(401).json({ message: "Department authorization is required" });
    return null;
  }
  return department;
};

const hasConnectionAccess = async (connectionId, department) => {
  const rows = await dbQuery(
    "SELECT connection_id FROM Service_Connection WHERE connection_id = ? AND service_type = ?",
    [connectionId, department]
  );
  return rows.length > 0;
};

const hasConsumerAccess = async (consumerId, department) => {
  const rows = await dbQuery(
    `SELECT DISTINCT c.consumer_id
     FROM Consumer c
     JOIN Service_Connection sc ON sc.consumer_id = c.consumer_id
     WHERE c.consumer_id = ? AND sc.service_type = ?`,
    [consumerId, department]
  );
  return rows.length > 0;
};

const hasMeterAccess = async (meterId, department) => {
  const rows = await dbQuery(
    `SELECT m.meter_id
     FROM Meter m
     JOIN Service_Connection sc ON sc.connection_id = m.connection_id
     WHERE m.meter_id = ? AND sc.service_type = ?`,
    [meterId, department]
  );
  return rows.length > 0;
};

const hasRecordAccess = async (readingId, department) => {
  const readingTable = await getReadingTableName();
  const rows = await dbQuery(
    `SELECT r.reading_id
     FROM ${readingTable} r
     JOIN Meter m ON m.meter_id = r.meter_id
     JOIN Service_Connection sc ON sc.connection_id = m.connection_id
     WHERE r.reading_id = ? AND sc.service_type = ?`,
    [readingId, department]
  );
  return rows.length > 0;
};

const hasBillAccess = async (billId, department) => {
  const rows = await dbQuery(
    `SELECT b.bill_id
     FROM Bill b
     JOIN Service_Connection sc ON sc.connection_id = b.connection_id
     WHERE b.bill_id = ? AND sc.service_type = ?`,
    [billId, department]
  );
  return rows.length > 0;
};

const hasPaymentAccess = async (paymentId, department) => {
  const rows = await dbQuery(
    `SELECT p.payment_id
     FROM Payment p
     JOIN Bill b ON b.bill_id = p.bill_id
     JOIN Service_Connection sc ON sc.connection_id = b.connection_id
     WHERE p.payment_id = ? AND sc.service_type = ?`,
    [paymentId, department]
  );
  return rows.length > 0;
};

const hasTariffAccess = async (tariffId, department) => {
  const rows = await dbQuery(
    "SELECT tariff_id FROM Tariff_Plan WHERE tariff_id = ? AND service_type = ?",
    [tariffId, department]
  );
  return rows.length > 0;
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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  try {
    const [consumers, totalConnections, activeMeters, pendingBills, revenue] = await Promise.all([
      dbQuery(
        `SELECT COUNT(DISTINCT sc.consumer_id) AS count
         FROM Service_Connection sc
         WHERE sc.service_type = ?`,
        [department]
      ),
      dbQuery(
        "SELECT COUNT(*) AS count FROM Service_Connection WHERE service_type = ?",
        [department]
      ),
      dbQuery(
        `SELECT COUNT(*) AS count
         FROM Meter m
         JOIN Service_Connection sc ON sc.connection_id = m.connection_id
         WHERE m.meter_status = 'Active' AND sc.service_type = ?`,
        [department]
      ),
      dbQuery(
        `SELECT COUNT(*) AS count
         FROM Bill b
         JOIN Service_Connection sc ON sc.connection_id = b.connection_id
         WHERE b.payment_status = 'Unpaid' AND sc.service_type = ?`,
        [department]
      ),
      dbQuery(
        `SELECT COALESCE(SUM(p.amount_paid), 0) AS total
         FROM Payment p
         JOIN Bill b ON b.bill_id = p.bill_id
         JOIN Service_Connection sc ON sc.connection_id = b.connection_id
         WHERE sc.service_type = ?`,
        [department]
      )
    ]);

    res.json({
      consumers: consumers[0].count,
      totalConnections: totalConnections[0].count,
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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    `SELECT DISTINCT c.*
     FROM Consumer c
     JOIN Service_Connection sc ON sc.consumer_id = c.consumer_id
     WHERE sc.service_type = ?`,
    [department],
    (err, result) => {
      if (err) return sendError(res, "Failed to fetch consumers", err);
      res.json(result);
    }
  );
});

app.post("/consumers", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { name, address, contact_no, consumer_type, registration_date } = req.body;
  const normalizedRegistrationDate = normalizeSqlDate(registration_date);

  if (!normalizedRegistrationDate) {
    return res.status(400).json({ message: "registration_date is required and must be a valid date" });
  }

  try {
    const consumer_id = await nextId("Consumer", "consumer_id");
    await dbQuery(
      "INSERT INTO Consumer (consumer_id, name, address, contact_no, consumer_type, registration_date) VALUES (?, ?, ?, ?, ?, ?)",
      [consumer_id, name, address, contact_no, consumer_type, normalizedRegistrationDate]
    );
    res.status(201).json({ message: "Consumer Added", consumer_id });
  } catch (error) {
    res.status(500).json({ message: "Failed to add consumer", error: error.message });
  }
});

app.put("/consumers/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasConsumerAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this consumer" });
  }

  const { name, address, contact_no, consumer_type, registration_date } = req.body;
  const normalizedRegistrationDate = normalizeSqlDate(registration_date);

  if (!normalizedRegistrationDate) {
    return res.status(400).json({ message: "registration_date is required and must be a valid date" });
  }

  db.query(
    "UPDATE Consumer SET name=?, address=?, contact_no=?, consumer_type=?, registration_date=? WHERE consumer_id=?",
    [name, address, contact_no, consumer_type, normalizedRegistrationDate, req.params.id],
    (err) => {
      if (err) return sendError(res, "Failed to update consumer", err);
      res.send("Consumer Updated");
    }
  );
});

app.delete("/consumers/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasConsumerAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this consumer" });
  }

  db.query("DELETE FROM Consumer WHERE consumer_id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to delete consumer", error: err.message });
    res.send("Consumer Deleted");
  });
});

app.get("/consumers/:id", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    `SELECT DISTINCT c.*
     FROM Consumer c
     JOIN Service_Connection sc ON sc.consumer_id = c.consumer_id
     WHERE c.consumer_id=? AND sc.service_type = ?`,
    [req.params.id, department],
    (err, result) => {
    if (err) return sendError(res, "Failed to fetch consumer", err);
    if (!result.length) return res.status(404).json({ message: "Consumer not found" });
    res.json(result[0]);
    }
  );
});

//////////////////////////////////////////////////////
// ✅ SERVICE CONNECTIONS
//////////////////////////////////////////////////////

app.get("/connections", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query("SELECT * FROM Service_Connection WHERE service_type = ?", [department], (err, result) => {
    if (err) return sendError(res, "Failed to fetch connections", err);
    res.json(result);
  });
});

app.post("/connections", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { service_type, installation_address, connection_status, consumer_id } = req.body;

  if (service_type && normalizeDepartment(service_type) !== department) {
    return res.status(403).json({ message: "Cannot create connection for another department" });
  }

  try {
    const connection_id = await nextId("Service_Connection", "connection_id");
    await dbQuery(
      "INSERT INTO Service_Connection (connection_id, service_type, installation_address, connection_status, consumer_id) VALUES (?, ?, ?, ?, ?)",
      [connection_id, department, installation_address, connection_status, consumer_id]
    );
    res.status(201).json({ message: "Connection Added", connection_id });
  } catch (error) {
    res.status(500).json({ message: "Failed to add connection", error: error.message });
  }
});

app.put("/connections/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasConnectionAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this connection" });
  }

  const { service_type, installation_address, connection_status, consumer_id } = req.body;

  if (service_type && normalizeDepartment(service_type) !== department) {
    return res.status(403).json({ message: "Cannot move connection to another department" });
  }

  db.query(
    "UPDATE Service_Connection SET service_type=?, installation_address=?, connection_status=?, consumer_id=? WHERE connection_id=?",
    [department, installation_address, connection_status, consumer_id, req.params.id],
    (err) => {
      if (err) return sendError(res, "Failed to update connection", err);
      res.send("Connection Updated");
    }
  );
});

app.delete("/connections/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasConnectionAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this connection" });
  }

  db.query("DELETE FROM Service_Connection WHERE connection_id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to delete connection", error: err.message });
    res.send("Connection Deleted");
  });
});

app.get("/connections/:id", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    "SELECT * FROM Service_Connection WHERE connection_id=? AND service_type = ?",
    [req.params.id, department],
    (err, result) => {
    if (err) return sendError(res, "Failed to fetch connection", err);
    if (!result.length) return res.status(404).json({ message: "Connection not found" });
    res.json(result[0]);
    }
  );
});

//////////////////////////////////////////////////////
// ✅ METERS
//////////////////////////////////////////////////////

app.get("/meters", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    `SELECT m.*
     FROM Meter m
     JOIN Service_Connection sc ON sc.connection_id = m.connection_id
     WHERE sc.service_type = ?`,
    [department],
    (err, result) => {
      if (err) return sendError(res, "Failed to fetch meters", err);
      res.json(result);
    }
  );
});

app.post("/meters", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { meter_number, installation_date, meter_status, connection_id } = req.body;

  if (!meter_number || !installation_date || !meter_status || !connection_id) {
    return res.status(400).json({ message: "All meter fields are required" });
  }

  if (!(await hasConnectionAccess(connection_id, department))) {
    return res.status(403).json({ message: "Access denied for selected connection" });
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

app.put("/meters/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasMeterAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this meter" });
  }

  const { meter_number, installation_date, meter_status, connection_id } = req.body;

  if (!meter_number || !installation_date || !meter_status || !connection_id) {
    return res.status(400).json({ message: "All meter fields are required" });
  }

  if (!(await hasConnectionAccess(connection_id, department))) {
    return res.status(403).json({ message: "Access denied for selected connection" });
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

app.delete("/meters/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasMeterAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this meter" });
  }

  db.query("DELETE FROM Meter WHERE meter_id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to delete meter", error: err.message });
    res.send("Meter Deleted");
  });
});

app.get("/meters/:id", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    `SELECT m.*
     FROM Meter m
     JOIN Service_Connection sc ON sc.connection_id = m.connection_id
     WHERE m.meter_id=? AND sc.service_type = ?`,
    [req.params.id, department],
    (err, result) => {
    if (err) return sendError(res, "Failed to fetch meter", err);
    if (!result.length) return res.status(404).json({ message: "Meter not found" });
    res.json(result[0]);
    }
  );
});

//////////////////////////////////////////////////////
// ✅ RECORDS
//////////////////////////////////////////////////////

app.get("/records", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  try {
    const readingTable = await getReadingTableName();
    const result = await dbQuery(
      `SELECT r.*
       FROM ${readingTable} r
       JOIN Meter m ON m.meter_id = r.meter_id
       JOIN Service_Connection sc ON sc.connection_id = m.connection_id
       WHERE sc.service_type = ?`,
      [department]
    );
    res.json(result);
  } catch (error) {
    return sendError(res, "Failed to fetch records", error);
  }
});

app.post("/records", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { current_reading, consumption_units, reading_date, meter_id } = req.body;

  if (!consumption_units || consumption_units < 0) {
    return res.status(400).json({ message: "Consumption units must be a positive number" });
  }

  try {
    if (!(await hasMeterAccess(meter_id, department))) {
      return res.status(403).json({ message: "Access denied for selected meter" });
    }

    const readingTable = await getReadingTableName();
    const reading_id = await nextId(readingTable, "reading_id");

    await dbQuery(
      `INSERT INTO ${readingTable} (reading_id, current_reading, consumption_units, reading_date, meter_id) VALUES (?, ?, ?, ?, ?)`,
      [reading_id, current_reading, consumption_units, reading_date, meter_id]
    );

    res.status(201).json({ message: "Record Added", reading_id });
  } catch (error) {
    res.status(500).json({ message: "Failed to add record", error: error.message });
  }
});

app.put("/records/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { current_reading, consumption_units, reading_date, meter_id } = req.body;

  if (!consumption_units || consumption_units < 0) {
    return res.status(400).json({ message: "Consumption units must be a positive number" });
  }

  try {
    if (!(await hasRecordAccess(req.params.id, department))) {
      return res.status(403).json({ message: "Access denied for this record" });
    }

    if (!(await hasMeterAccess(meter_id, department))) {
      return res.status(403).json({ message: "Access denied for selected meter" });
    }

    const readingTable = await getReadingTableName();
    await dbQuery(
      `UPDATE ${readingTable} SET current_reading=?, consumption_units=?, reading_date=?, meter_id=? WHERE reading_id=?`,
      [current_reading, consumption_units, reading_date, meter_id, req.params.id]
    );
    res.send("Record Updated");
  } catch (error) {
    return sendError(res, "Failed to update record", error);
  }
});

app.delete("/records/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  try {
    if (!(await hasRecordAccess(req.params.id, department))) {
      return res.status(403).json({ message: "Access denied for this record" });
    }

    const readingTable = await getReadingTableName();
    await dbQuery(`DELETE FROM ${readingTable} WHERE reading_id=?`, [req.params.id]);
    res.send("Record Deleted");
  } catch (error) {
    return sendError(res, "Failed to delete record", error);
  }
});

app.get("/records/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  try {
    const readingTable = await getReadingTableName();
    const result = await dbQuery(
      `SELECT r.*
       FROM ${readingTable} r
       JOIN Meter m ON m.meter_id = r.meter_id
       JOIN Service_Connection sc ON sc.connection_id = m.connection_id
       WHERE r.reading_id=? AND sc.service_type = ?`,
      [req.params.id, department]
    );
    if (!result.length) return res.status(404).json({ message: "Record not found" });
    res.json(result[0]);
  } catch (error) {
    return sendError(res, "Failed to fetch record", error);
  }
});

//////////////////////////////////////////////////////
// ✅ BILLS
//////////////////////////////////////////////////////

app.get("/bills", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    `SELECT b.*
     FROM Bill b
     JOIN Service_Connection sc ON sc.connection_id = b.connection_id
     WHERE sc.service_type = ?`,
    [department],
    (err, result) => {
    if (err) {
      return sendError(res, "Failed to fetch bills", err);
    }
    res.json(result);
    }
  );
});

app.get("/bills/:id", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    `SELECT b.*
     FROM Bill b
     JOIN Service_Connection sc ON sc.connection_id = b.connection_id
     WHERE b.bill_id=? AND sc.service_type = ?`,
    [req.params.id, department],
    (err, result) => {
    if (err) return sendError(res, "Failed to fetch bill", err);
    if (!result.length) return res.status(404).json({ message: "Bill not found" });
    res.json(result[0]);
    }
  );
});

app.post("/bills", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { bill_number, billing_period, total_amount, due_date, payment_status, connection_id, reading_id } = req.body;

  if (!(await hasConnectionAccess(connection_id, department))) {
    return res.status(403).json({ message: "Access denied for selected connection" });
  }

  if (!(await hasRecordAccess(reading_id, department))) {
    return res.status(403).json({ message: "Access denied for selected record" });
  }

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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { bill_number, billing_period, due_date, connection_id, reading_id } = req.body;

  if (!bill_number || !connection_id || !reading_id || !due_date) {
    return res.status(400).json({ message: "bill_number, connection_id, reading_id and due_date are required" });
  }

  try {
    if (!(await hasConnectionAccess(connection_id, department))) {
      return res.status(403).json({ message: "Access denied for selected connection" });
    }

    if (!(await hasRecordAccess(reading_id, department))) {
      return res.status(403).json({ message: "Access denied for selected record" });
    }

    const readingTable = await getReadingTableName();
    const readingRows = await dbQuery(
      `SELECT consumption_units FROM ${readingTable} WHERE reading_id = ?`,
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

app.put("/bills/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasBillAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this bill" });
  }

  const { bill_number, billing_period, total_amount, due_date, payment_status, connection_id, reading_id } = req.body;

  if (!(await hasConnectionAccess(connection_id, department))) {
    return res.status(403).json({ message: "Access denied for selected connection" });
  }

  if (!(await hasRecordAccess(reading_id, department))) {
    return res.status(403).json({ message: "Access denied for selected record" });
  }

  db.query(
    "UPDATE Bill SET bill_number=?, billing_period=?, total_amount=?, due_date=?, payment_status=?, connection_id=?, reading_id=? WHERE bill_id=?",
    [bill_number, billing_period, total_amount, due_date, payment_status, connection_id, reading_id, req.params.id],
    (err) => {
      if (err) return res.send(err);
      res.send("Bill Updated");
    }
  );
});

app.delete("/bills/:id", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasBillAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this bill" });
  }

  db.query("DELETE FROM Bill WHERE bill_id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to delete bill", error: err.message });
    res.send("Bill Deleted");
  });
});

//////////////////////////////////////////////////////
// ✅ PAYMENTS
//////////////////////////////////////////////////////

app.get("/payments", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    `SELECT p.*
     FROM Payment p
     JOIN Bill b ON b.bill_id = p.bill_id
     JOIN Service_Connection sc ON sc.connection_id = b.connection_id
     WHERE sc.service_type = ?`,
    [department],
    (err, result) => {
      if (err) return sendError(res, "Failed to fetch payments", err);
      res.json(result);
    }
  );
});

app.get("/payments/:id", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    `SELECT p.*
     FROM Payment p
     JOIN Bill b ON b.bill_id = p.bill_id
     JOIN Service_Connection sc ON sc.connection_id = b.connection_id
     WHERE p.payment_id=? AND sc.service_type = ?`,
    [req.params.id, department],
    (err, result) => {
    if (err) return sendError(res, "Failed to fetch payment", err);
    if (!result.length) return res.status(404).json({ message: "Payment not found" });
    res.json(result[0]);
    }
  );
});

app.post("/payments", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { payment_date, amount_paid, payment_mode, bill_id } = req.body;

  try {
    if (!(await hasBillAccess(bill_id, department))) {
      return res.status(403).json({ message: "Access denied for selected bill" });
    }

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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasPaymentAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this payment" });
  }

  const { payment_date, amount_paid, payment_mode, bill_id } = req.body;
  try {
    if (!(await hasBillAccess(bill_id, department))) {
      return res.status(403).json({ message: "Access denied for selected bill" });
    }

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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasPaymentAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this payment" });
  }

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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

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
    WHERE service_type = ?
     ORDER BY tariff_id DESC`,
      [department],
    (err, result) => {
    if (err) return sendError(res, "Failed to fetch tariffs", err);
    res.json(result);
    }
  );
});

app.get("/tariffs/:id", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

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
     WHERE tariff_id = ? AND service_type = ?`,
    [req.params.id, department],
    (err, result) => {
      if (err) return sendError(res, "Failed to fetch tariff", err);
      if (!result.length) return res.status(404).json({ message: "Tariff not found" });
      res.json(result[0]);
    }
  );
});

app.post("/tariffs", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const {
    service_type = department,
    consumer_type = "Residential",
    rate_per_unit,
    fixed_charge,
    tax_percentage = 0,
    effective_from
  } = req.body;

  try {
    if (normalizeDepartment(service_type) !== department) {
      return res.status(403).json({ message: "Cannot create tariff for another department" });
    }

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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  if (!(await hasTariffAccess(req.params.id, department))) {
    return res.status(403).json({ message: "Access denied for this tariff" });
  }

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
        department,
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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  hasTariffAccess(req.params.id, department)
    .then((allowed) => {
      if (!allowed) {
        return res.status(403).json({ message: "Access denied for this tariff" });
      }
      db.query("DELETE FROM Tariff_Plan WHERE tariff_id=?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: "Failed to delete tariff", error: err.message });
        res.send("Tariff Deleted");
      });
    })
    .catch((error) => sendError(res, "Failed to delete tariff", error));
});

//////////////////////////////////////////////////////
// ✅ CONNECTION TARIFF
//////////////////////////////////////////////////////

app.get("/connection-tariffs", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

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
    JOIN Service_Connection sc ON sc.connection_id = ct.connection_id
     LEFT JOIN Tariff_Plan tp ON tp.tariff_id = ct.tariff_id
    WHERE sc.service_type = ?
     ORDER BY ct.connection_tariff_id DESC`,
      [department],
    (err, result) => {
    if (err) return sendError(res, "Failed to fetch connection tariffs", err);
    res.json(result);
    }
  );
});

app.get("/connection-tariffs/:id", (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

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
     JOIN Service_Connection sc ON sc.connection_id = ct.connection_id
     LEFT JOIN Tariff_Plan tp ON tp.tariff_id = ct.tariff_id
     WHERE ct.connection_tariff_id = ? AND sc.service_type = ?`,
    [req.params.id, department],
    (err, result) => {
      if (err) return sendError(res, "Failed to fetch connection tariff", err);
      if (!result.length) return res.status(404).json({ message: "Connection tariff not found" });
      res.json(result[0]);
    }
  );
});

app.post("/connection-tariffs", async (req, res) => {
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { connection_id, plan_id, tariff_id, effective_from, start_date, end_date } = req.body;

  try {
    if (!(await hasConnectionAccess(connection_id, department))) {
      return res.status(403).json({ message: "Access denied for selected connection" });
    }

    const selectedTariffId = tariff_id || plan_id;
    if (!(await hasTariffAccess(selectedTariffId, department))) {
      return res.status(403).json({ message: "Access denied for selected tariff" });
    }

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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  const { connection_id, plan_id, tariff_id, effective_from, start_date, end_date } = req.body;

  try {
    const existing = await dbQuery(
      `SELECT ct.connection_tariff_id
       FROM Connection_Tariff ct
       JOIN Service_Connection sc ON sc.connection_id = ct.connection_id
       WHERE ct.connection_tariff_id = ? AND sc.service_type = ?`,
      [req.params.id, department]
    );
    if (!existing.length) {
      return res.status(403).json({ message: "Access denied for this connection tariff" });
    }

    if (!(await hasConnectionAccess(connection_id, department))) {
      return res.status(403).json({ message: "Access denied for selected connection" });
    }

    const selectedTariffId = tariff_id || plan_id;
    if (!(await hasTariffAccess(selectedTariffId, department))) {
      return res.status(403).json({ message: "Access denied for selected tariff" });
    }

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
  const department = requireDepartment(req, res);
  if (!department) {
    return;
  }

  db.query(
    `DELETE ct
     FROM Connection_Tariff ct
     JOIN Service_Connection sc ON sc.connection_id = ct.connection_id
     WHERE ct.connection_tariff_id=? AND sc.service_type = ?`,
    [req.params.id, department],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to delete connection tariff", error: err.message });
      if (!result.affectedRows) {
        return res.status(403).json({ message: "Access denied for this connection tariff" });
      }
      res.send("Connection Tariff Deleted");
    }
  );
});

//////////////////////////////////////////////////////

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});