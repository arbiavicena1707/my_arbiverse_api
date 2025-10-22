import db from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// 🔹 REGISTER (khusus admin)
export const registerKasir = (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({
      status: 400,
      message: "Data belum lengkap (username, password, role wajib diisi)",
    });
  }

  // Validasi role
  if (!["admin", "kasir"].includes(role)) {
    return res.status(400).json({
      status: 400,
      message: "Role harus 'admin' atau 'kasir'",
    });
  }

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    if (results.length > 0) {
      return res.status(400).json({ status: 400, message: "Username sudah dipakai" });
    }

    const hashed = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, hashed, role],
      (err, result) => {
        if (err)
          return res.status(500).json({
            status: 500,
            message: "Gagal membuat user",
            error: err.message,
          });

        res.status(201).json({
          status: 201,
          message: "✅ User berhasil dibuat",
          data: { id: result.insertId, username, role },
        });
      }
    );
  });
};

// 🔹 LOGIN
export const loginKasir = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({
      status: 400,
      message: "Username dan password wajib diisi",
    });

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    if (results.length === 0)
      return res.status(404).json({ status: 404, message: "User tidak ditemukan" });

    const user = results[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid)
      return res.status(401).json({ status: 401, message: "Password salah" });

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET belum diatur di file .env");
      return res.status(500).json({
        status: 500,
        message: "Server error: JWT_SECRET tidak ditemukan",
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      status: 200,
      message: "✅ Login berhasil",
      data: {
        token,
        user: { id: user.id, username: user.username, role: user.role },
      },
    });
  });
};

// 🔹 Tambah item (khusus admin)
export const addItem = (req, res) => {
  const { nama } = req.body;
  const harga = Number(req.body.harga);
  const stok = Number(req.body.stok);
  const file = req.file;
  const gambar = file ? `/public/${file.filename}` : null;
  const role = req.user?.role;

  if (role !== "admin")
    return res.status(403).json({
      status: 403,
      message: "Hanya admin yang bisa menambah item",
    });

  if (!nama || isNaN(harga) || isNaN(stok))
    return res.status(400).json({
      status: 400,
      message: "Nama, harga, dan stok wajib diisi dengan benar",
    });

  const sql = "INSERT INTO items (nama, harga, stok, gambar) VALUES (?, ?, ?, ?)";
  db.query(sql, [nama, harga, stok, gambar], (err, result) => {
    if (err)
      return res.status(500).json({
        status: 500,
        message: "Gagal menambah item",
        error: err.message,
      });

    res.status(201).json({
      status: 201,
      message: "✅ Item berhasil ditambahkan",
      data: {
        id: result.insertId,
        nama,
        harga,
        stok,
        gambar,
      },
    });
  });
};


// 🔹 Ambil semua item (admin & kasir)
export const getItems = (req, res) => {
  db.query("SELECT * FROM items", (err, results) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    res.json({
      status: 200,
      message: "✅ Data item berhasil diambil",
      data: results,
    });
  });
};

// 🔹 Update item (khusus admin)
export const updateItem = (req, res) => {
  const { id } = req.params;
  const { nama, harga, stok, gambar } = req.body;
  const role = req.user?.role;

  if (role !== "admin")
    return res.status(403).json({
      status: 403,
      message: "Hanya admin yang bisa mengupdate item",
    });

  // Cek apakah item ada
  db.query("SELECT * FROM items WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    if (results.length === 0)
      return res.status(404).json({ status: 404, message: "Item tidak ditemukan" });

    // Update hanya field yang dikirim
    const updates = [];
    const values = [];

    if (nama !== undefined) {
      updates.push("nama = ?");
      values.push(nama);
    }
    if (harga !== undefined) {
      updates.push("harga = ?");
      values.push(harga);
    }
    if (stok !== undefined) {
      updates.push("stok = ?");
      values.push(stok);
    }
    if (gambar !== undefined) {
      updates.push("gambar = ?");
      values.push(gambar);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Tidak ada data yang diupdate",
      });
    }

    values.push(id);
    const sql = `UPDATE items SET ${updates.join(", ")} WHERE id = ?`;

    db.query(sql, values, (err) => {
      if (err)
        return res.status(500).json({
          status: 500,
          message: "Gagal mengupdate item",
          error: err.message,
        });

      res.json({
        status: 200,
        message: "✅ Item berhasil diupdate",
      });
    });
  });
};

// 🔹 Hapus item (khusus admin)
export const deleteItem = (req, res) => {
  const { id } = req.params;
  const role = req.user?.role;

  if (role !== "admin")
    return res.status(403).json({
      status: 403,
      message: "Hanya admin yang bisa menghapus item",
    });

  db.query("DELETE FROM items WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    if (result.affectedRows === 0)
      return res.status(404).json({ status: 404, message: "Item tidak ditemukan" });

    res.json({
      status: 200,
      message: "✅ Item berhasil dihapus",
    });
  });
};