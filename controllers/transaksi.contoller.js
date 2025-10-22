import db from "../config/db.js";

// 🔹 Simpan transaksi baru (kasir)
export const createTransaksi = (req, res) => {
  const role = req.user?.role;
  const kasir_id = req.user?.id;
  const { items, total, bayar, kembalian } = req.body;

  if (role !== "kasir" && role !== "admin") {
    return res
      .status(403)
      .json({ status: 403, message: "Hanya kasir yang bisa membuat transaksi" });
  }

  if (!items || items.length === 0) {
    return res
      .status(400)
      .json({ status: 400, message: "Daftar item tidak boleh kosong" });
  }

  // Validasi total dan bayar
  // Ubah string menjadi number (jika perlu)
  const parsedTotal = Number(total);
  const parsedBayar = Number(bayar);

  // Validasi hasil konversi
  if (isNaN(parsedTotal) || isNaN(parsedBayar)) {
    return res.status(400).json({
      status: 400,
      message: "Total dan bayar harus berupa angka yang valid",
    });
  }

  // Lanjut pakai nilai hasil konversi
  kembalian = parsedBayar - parsedTotal;

  // Validasi kembalian
  if (bayar < total) {
    return res.status(400).json({
      status: 400,
      message: "Uang bayar kurang dari total",
    });
  }

  // Simpan transaksi
  const sqlTransaksi =
    "INSERT INTO transactions (kasir_id, total, bayar, kembalian, tanggal) VALUES (?, ?, ?, ?, NOW())";
  db.query(sqlTransaksi, [kasir_id, total, bayar, kembalian], (err, result) => {
    if (err)
      return res.status(500).json({
        status: 500,
        message: "Gagal menyimpan transaksi",
        error: err.message,
      });

    const transaksi_id = result.insertId;

    // Simpan detail item transaksi
    const sqlDetail =
      "INSERT INTO transaction_items (transaction_id, item_id, jumlah, subtotal) VALUES ?";
    const values = items.map((item) => [
      transaksi_id,
      item.item_id,
      item.qty,
      item.subtotal,
    ]);

    db.query(sqlDetail, [values], (err2) => {
      if (err2)
        return res.status(500).json({
          status: 500,
          message: "Gagal menyimpan detail transaksi",
          error: err2.message,
        });

      // ✅ Kurangi stok barang dengan prepared statement (AMAN dari SQL Injection)
      let completedQueries = 0;
      let hasError = false;

      items.forEach((item) => {
        db.query(
          "UPDATE items SET stok = stok - ? WHERE id = ?",
          [item.qty, item.item_id],
          (err3) => {
            if (err3 && !hasError) {
              hasError = true;
              return res.status(500).json({
                status: 500,
                message: "Gagal mengupdate stok barang",
                error: err3.message,
              });
            }

            completedQueries++;

            // Jika semua query selesai
            if (completedQueries === items.length && !hasError) {
              res.status(201).json({
                status: 201,
                message: "✅ Transaksi berhasil disimpan",
                data: { transaksi_id, total, bayar, kembalian, items },
              });
            }
          }
        );
      });
    });
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
      SELECT d.*, i.nama AS item_name
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