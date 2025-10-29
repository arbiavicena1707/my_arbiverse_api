import db from "../config/db.js";
import crypto from "crypto";

const generateKode = () => "GY" + crypto.randomBytes(3).toString("hex").toUpperCase();


export const createTransaksi = (req, res) => {
  const role = req.user?.role || "user"; // kalau gak ada token → otomatis user
  const kasir_id = req.user?.id || null;

  let { items, total, bayar, kembalian, metode } = req.body;

  // 🧾 Parse items dari FormData
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return res.status(400).json({
        status: 400,
        message: "Format items tidak valid",
      });
    }
  }

  total = Number(total);
  bayar = Number(bayar || 0);
  kembalian = Number(kembalian || 0);
  metode = metode || "kasir";

  // 🛡️ Validasi item
  if (!items?.length)
    return res.status(400).json({ status: 400, message: "Daftar item tidak boleh kosong" });
  if (isNaN(total))
    return res.status(400).json({ status: 400, message: "Total harus berupa angka" });

  // 🧩 Tentukan status otomatis
  const kode_transaksi = generateKode();
  const status = role === "kasir" || role === "admin" ? "completed" : "pending";

  // 💾 Simpan transaksi
  const sql = `
    INSERT INTO transactions 
    (kode_transaksi, kasir_id, total, bayar, kembalian, metode, status, tanggal)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(sql, [kode_transaksi, kasir_id, total, bayar, kembalian, metode, status], (err, result) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    const transaksi_id = result.insertId;
    const sqlDetail = `
      INSERT INTO transaction_items (transaction_id, item_id, jumlah, subtotal) VALUES ?
    `;
    const values = items.map((i) => [transaksi_id, i.item_id, i.qty, i.subtotal]);

    db.query(sqlDetail, [values], (err2) => {
      if (err2) return res.status(500).json({ status: 500, message: err2.message });

      // Kalau kasir → langsung kurangi stok
      if (role === "kasir" || role === "admin") {
        items.forEach((i) => {
          db.query("UPDATE items SET stok = stok - ? WHERE id = ?", [i.qty, i.item_id]);
        });
      }

      res.status(201).json({
        status: 201,
        message: `✅ Transaksi berhasil disimpan (${status})`,
        data: { kode_transaksi, status, total, metode },
      });
    });
  });
};


// 🔹 Transaksi dari user (baru)
export const createTransaksiUser = (req, res) => {
  let { items, total, metode } = req.body;

  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return res.status(400).json({ status: 400, message: "Format items tidak valid" });
    }
  }

  total = Number(total);
  metode = metode || "kasir";
  const kode_transaksi = generateKode();
  const status = "pending";

  if (!items?.length) return res.status(400).json({ status: 400, message: "Daftar item tidak boleh kosong" });
  if (isNaN(total)) return res.status(400).json({ status: 400, message: "Total harus berupa angka" });

  const sql =
    "INSERT INTO transactions (kode_transaksi, total, metode, status, tanggal) VALUES (?, ?, ?, ?, NOW())";
  db.query(sql, [kode_transaksi, total, metode, status], (err, result) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    const transaksi_id = result.insertId;
    const sqlDetail =
      "INSERT INTO transaction_items (transaction_id, item_id, jumlah, subtotal) VALUES ?";
    const values = items.map((i) => [transaksi_id, i.item_id, i.qty, i.subtotal]);

    db.query(sqlDetail, [values], (err2) => {
      if (err2) return res.status(500).json({ status: 500, message: err2.message });

      res.status(201).json({
        status: 201,
        message: "✅ Pesanan user berhasil dibuat",
        data: { kode_transaksi, total, metode, status },
      });
    });
  });
};

// 🔹 Kasir ubah status transaksi (paid, processing, completed, canceled)
export const updateTransaksiStatus = (req, res) => {
  const { id } = req.params;
  const role = req.user?.role;
  const kasir_id = req.user?.id;
  const { status, bayar } = req.body;

  if (role !== "kasir" && role !== "admin")
    return res.status(403).json({ status: 403, message: "Hanya kasir atau admin yang boleh update transaksi" });

  const sqlGet = "SELECT * FROM transactions WHERE id = ?";
  db.query(sqlGet, [id], (err, results) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });
    if (results.length === 0)
      return res.status(404).json({ status: 404, message: "Transaksi tidak ditemukan" });

    const transaksi = results[0];

    // Hitung kembalian
    const bayarAngka = Number(bayar || 0);
    const kembalian = bayarAngka - transaksi.total;

    const sqlUpdate = `
      UPDATE transactions 
      SET status = ?, bayar = ?, kembalian = ?, kasir_id = ?
      WHERE id = ?
    `;

    db.query(sqlUpdate, [status || "completed", bayarAngka, kembalian, kasir_id, id], (err2) => {
      if (err2) return res.status(500).json({ status: 500, message: err2.message });

      res.json({
        status: 200,
        message: "✅ Transaksi berhasil diperbarui",
        data: {
          id,
          status: status || "completed",
          total: transaksi.total,
          bayar: bayarAngka,
          kembalian,
        },
      });
    });
  });
};



// 🔹 Ambil semua transaksi (admin)
export const getAllTransaksi = (req, res) => {
  const role = req.user?.role;
  const userId = req.user?.id;
  const { status } = req.query;

  let sql = `
    SELECT 
      t.*, 
      u.username AS kasir
    FROM transactions t
    LEFT JOIN users u ON t.kasir_id = u.id
  `;
  const values = [];


  sql += " WHERE t.status = ?";
  values.push(status);


  sql += " ORDER BY t.tanggal DESC";

  db.query(sql, values, (err, results) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });
    res.json({
      status: 200,
      message: "✅ Daftar transaksi berhasil diambil",
      data: results,
    });
  });
};


// 🔹 Ambil detail transaksi (admin/kasir)
export const getTransaksiById = (req, res) => {
  const { id } = req.params;
  const role = req.user?.role;
  const userId = req.user?.id;

  // Ambil data transaksi utama
  const sqlTransaksi = `
    SELECT t.*, u.username AS kasir
    FROM transactions t
    JOIN users u ON t.kasir_id = u.id
    WHERE t.id = ?
  `;

  db.query(sqlTransaksi, [id], (err, result) => {
    if (err)
      return res.status(500).json({ status: 500, message: err.message });
    if (result.length === 0)
      return res.status(404).json({ status: 404, message: "Transaksi tidak ditemukan" });

    const transaksi = result[0];



    // Ambil detail item
    const sqlDetail = `
  SELECT 
    d.*, 
    i.nama AS item_name, 
    i.kategori AS item_kategori
  FROM transaction_items d
  JOIN items i ON d.item_id = i.id
  WHERE d.transaction_id = ?
`;


    db.query(sqlDetail, [id], (err2, detail) => {
      if (err2)
        return res.status(500).json({ status: 500, message: err2.message });

      res.json({
        status: 200,
        message: "✅ Detail transaksi berhasil diambil",
        data: { ...transaksi, items: detail },
      });
    });
  });
};

// 🔹 Resume transaksi untuk dashboard (admin)
export const getTransaksiResume = (req, res) => {
  const role = req.user?.role;
  if (role !== "admin") {
    return res.status(403).json({
      status: 403,
      message: "Hanya admin yang bisa melihat resume transaksi",
    });
  }

  // Query total transaksi dan total omzet
  const sql = `
    SELECT 
      COUNT(id) AS total_transaksi,
      SUM(total) AS total_omzet
    FROM transactions
    WHERE status IN ('paid', 'completed')
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        status: 500,
        message: "Gagal mengambil data resume",
        error: err.message,
      });
    }

    const summary = result[0];
    summary.total_modal = 0; // tidak ada data modal di tabel
    summary.total_keuntungan = summary.total_omzet; // asumsikan semua omzet adalah keuntungan

    // Query omzet per hari untuk chart
    const sqlChart = `
      SELECT 
        DATE(tanggal) AS tanggal,
        SUM(total) AS omzet_harian
      FROM transactions
      WHERE status IN ('paid', 'completed')
      GROUP BY DATE(tanggal)
      ORDER BY tanggal ASC
    `;

    db.query(sqlChart, (err2, chartData) => {
      if (err2) {
        return res.status(500).json({
          status: 500,
          message: "Gagal mengambil data chart",
          error: err2.message,
        });
      }

      res.json({
        status: 200,
        message: "✅ Resume transaksi berhasil diambil",
        data: {
          summary,
          chart: chartData,
        },
      });
    });
  });
};

