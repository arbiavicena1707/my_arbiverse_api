import db from "../config/db.js";
import crypto from "crypto";

const generateKode = () => "GY" + crypto.randomBytes(3).toString("hex").toUpperCase();


export const createTransaksi = (req, res) => {
  const role = req.user?.role;
  const kasir_id = req.user?.id;
  let { items, total, bayar, kembalian, metode } = req.body;

  // 🧾 Parse FormData items (kalau masih string)
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return res.status(400).json({ status: 400, message: "Format items tidak valid" });
    }
  }

  total = Number(total);
  bayar = Number(bayar || 0);
  kembalian = Number(kembalian || 0);
  metode = metode || "kasir";

  if (role !== "kasir" && role !== "admin") {
    return res.status(403).json({ status: 403, message: "Hanya kasir yang bisa membuat transaksi ini" });
  }

  if (!items?.length) return res.status(400).json({ status: 400, message: "Daftar item tidak boleh kosong" });
  if (isNaN(total)) return res.status(400).json({ status: 400, message: "Total harus berupa angka" });

  const kode_transaksi = generateKode();
  const status = "completed"; // kasir langsung selesai karena bayar langsung

  const sql =
    "INSERT INTO transactions (kode_transaksi, kasir_id, total, bayar, kembalian, metode, status, tanggal) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";
  db.query(sql, [kode_transaksi, kasir_id, total, bayar, kembalian, metode, status], (err, result) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    const transaksi_id = result.insertId;
    const sqlDetail =
      "INSERT INTO transaction_items (transaction_id, item_id, jumlah, subtotal) VALUES ?";
    const values = items.map((i) => [transaksi_id, i.item_id, i.qty, i.subtotal]);

    db.query(sqlDetail, [values], (err2) => {
      if (err2) return res.status(500).json({ status: 500, message: err2.message });

      // Kurangi stok
      items.forEach((i) => {
        db.query("UPDATE items SET stok = stok - ? WHERE id = ?", [i.qty, i.item_id]);
      });

      res.status(201).json({
        status: 201,
        message: "✅ Transaksi kasir berhasil disimpan",
        data: { kode_transaksi, total, bayar, kembalian, metode },
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
  const { status } = req.body;
  const allowed = ["pending", "paid", "processing", "completed", "canceled"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ status: 400, message: "Status tidak valid" });
  }

  const sql = "UPDATE transactions SET status = ? WHERE id = ?";
  db.query(sql, [status, id], (err, result) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    res.json({ status: 200, message: `✅ Status diubah menjadi ${status}` });
  });
};


// 🔹 Ambil semua transaksi (admin)
export const getAllTransaksi = (req, res) => {
  const role = req.user?.role;
  if (role !== "admin")
    return res
      .status(403)
      .json({ status: 403, message: "Hanya admin yang bisa melihat semua transaksi" });

  const sql = `
    SELECT t.id, u.username AS kasir, t.total, t.bayar, t.kembalian, t.tanggal
    FROM transactions t
    JOIN users u ON t.kasir_id = u.id
    ORDER BY t.id DESC
  `;
  db.query(sql, (err, results) => {
    if (err)
      return res.status(500).json({ status: 500, message: err.message });

    res.json({ status: 200, message: "✅ Data transaksi berhasil diambil", data: results });
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

    // Kasir hanya boleh lihat transaksi miliknya sendiri
    if (role === "kasir" && transaksi.kasir_id !== userId) {
      return res.status(403).json({
        status: 403,
        message: "Kamu tidak boleh mengakses transaksi ini",
      });
    }

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

  // Ambil total omzet, total modal, dan keuntungan
  const sql = `
    SELECT 
      COUNT(DISTINCT t.id) AS total_transaksi,
      SUM(t.total) AS total_omzet,
      SUM(d.jumlah * i.harga_beli) AS total_modal,
      (SUM(t.total) - SUM(d.jumlah * i.harga_beli)) AS total_keuntungan
    FROM transactions t
    JOIN transaction_items d ON t.id = d.transaction_id
    JOIN items i ON d.item_id = i.id
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

    // Ambil data omzet per hari (buat chart)
    const sqlChart = `
      SELECT 
        DATE(t.tanggal) AS tanggal,
        SUM(t.total) AS omzet_harian,
        SUM(d.jumlah * i.harga_beli) AS modal_harian,
        (SUM(t.total) - SUM(d.jumlah * i.harga_beli)) AS keuntungan_harian
      FROM transactions t
      JOIN transaction_items d ON t.id = d.transaction_id
      JOIN items i ON d.item_id = i.id
      GROUP BY DATE(t.tanggal)
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
