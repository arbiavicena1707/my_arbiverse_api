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

export const updateUser = async (req, res) => {
  const role = req.user?.role;
  const { id } = req.params;
  const { username, password, role: newRole } = req.body;

  if (role !== "admin")
    return res.status(403).json({
      status: 403,
      message: "Hanya admin yang bisa mengubah user",
    });

  // Cek apakah user ada
  db.query("SELECT * FROM users WHERE id = ?", [id], async (err, results) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    if (results.length === 0)
      return res.status(404).json({ status: 404, message: "User tidak ditemukan" });

    const updates = [];
    const values = [];

    if (username) {
      updates.push("username = ?");
      values.push(username);
    }

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      updates.push("password = ?");
      values.push(hashed);
    }

    if (newRole && ["admin", "kasir"].includes(newRole)) {
      updates.push("role = ?");
      values.push(newRole);
    }

    if (updates.length === 0)
      return res.status(400).json({ status: 400, message: "Tidak ada data yang diupdate" });

    values.push(id);

    const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
    db.query(sql, values, (err) => {
      if (err)
        return res.status(500).json({ status: 500, message: err.message });

      res.json({
        status: 200,
        message: "✅ User berhasil diupdate",
      });
    });
  });
};

export const deleteUser = (req, res) => {
  const role = req.user?.role;
  const { id } = req.params;

  if (role !== "admin")
    return res.status(403).json({
      status: 403,
      message: "Hanya admin yang bisa menghapus user",
    });

  db.query("DELETE FROM users WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    if (result.affectedRows === 0)
      return res.status(404).json({ status: 404, message: "User tidak ditemukan" });

    res.json({
      status: 200,
      message: "✅ User berhasil dihapus",
    });
  });
};

export const getAllUsers = (req, res) => {
  const role = req.user?.role;

  if (role !== "admin")
    return res.status(403).json({
      status: 403,
      message: "Hanya admin yang bisa melihat daftar user",
    });

  // Perbarui query untuk mengambil `created_at` selain id, username, dan role
  db.query("SELECT id, username, role, created_at FROM users", (err, results) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    res.json({
      status: 200,
      message: "✅ Daftar user berhasil diambil",
      data: results,
    });
  });
};

// 🔹 Tambah item (khusus admin)
export const addItem = (req, res) => {
  const { nama, harga, stok, kategori } = req.body;
  const file = req.file;
  const gambar = file ? `/public/${file.filename}` : null;
  const role = req.user?.role;

  if (role !== "admin") {
    return res.status(403).json({
      status: 403,
      message: "Hanya admin yang bisa menambah item",
    });
  }

  // Validasi input
  if (!nama || isNaN(harga) || isNaN(stok)) {
    return res.status(400).json({
      status: 400,
      message: "Nama, harga, dan stok wajib diisi dengan benar",
    });
  }

  // Validasi kategori
  const allowedKategori = ["makanan", "minuman", "snack"];
  if (kategori && !allowedKategori.includes(kategori)) {
    return res.status(400).json({
      status: 400,
      message: "Kategori tidak valid. Gunakan: makanan, minuman, atau snack",
    });
  }

  const sql = "INSERT INTO items (nama, harga, stok, gambar, kategori) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [nama, harga, stok, gambar, kategori || "makanan"], (err, result) => {
    if (err) {
      return res.status(500).json({
        status: 500,
        message: "Gagal menambah item",
        error: err.message,
      });
    }

    res.status(201).json({
      status: 201,
      message: "✅ Item berhasil ditambahkan",
      data: {
        id: result.insertId,
        nama,
        harga,
        stok,
        gambar,
        kategori: kategori || "makanan",
      },
    });
  });
};



// 🔹 Ambil semua item (admin & kasir)
export const getItems = (req, res) => {
  const { kategori } = req.query;

  let sql = "SELECT * FROM items";
  const values = [];

  if (kategori) {
    sql += " WHERE kategori = ?";
    values.push(kategori);
  }

  db.query(sql, values, (err, results) => {
    if (err) return res.status(500).json({ status: 500, message: err.message });

    res.json({
      status: 200,
      message: "✅ Data item berhasil diambil",
      data: results,
    });
  });
};


export const updateItem = (req, res) => {
  const { id } = req.params;
  const { nama, harga, stok, kategori } = req.body;
  const role = req.user?.role;
  const gambarFile = req.file ? `/public/${req.file.filename}` : undefined;

  if (role !== "admin") {
    return res.status(403).json({
      status: 403,
      message: "Hanya admin yang bisa mengupdate item",
    });
  }

  const allowedKategori = ["makanan", "minuman", "snack"];
  if (kategori && !allowedKategori.includes(kategori)) {
    return res.status(400).json({
      status: 400,
      message: "Kategori tidak valid. Gunakan: makanan, minuman, atau snack",
    });
  }

  db.query("SELECT * FROM items WHERE id = ?", [id], (err, results) => {
    if (err)
      return res.status(500).json({ status: 500, message: err.message });

    if (results.length === 0) {
      return res
        .status(404)
        .json({ status: 404, message: "Item tidak ditemukan" });
    }

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
    if (gambarFile !== undefined) {
      updates.push("gambar = ?");
      values.push(gambarFile);
    }
    if (kategori !== undefined) {
      updates.push("kategori = ?");
      values.push(kategori);
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
      if (err) {
        return res.status(500).json({
          status: 500,
          message: "Gagal mengupdate item",
          error: err.message,
        });
      }

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