// controllers/akreditasiController.js
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname } from "path";
import XLSX from "xlsx";
import prisma from "../prismaClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templates = [
  { id: 1, nama_template: "Template BAN-PT", jenis_template: "PDF" },
  { id: 2, nama_template: "Template Internal", jenis_template: "Excel" },
];

// ---------- GET /api/akreditasi/stats ----------
export const getStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User tidak terautentikasi' });
    }

    // Ambil data dari database
    const items = await prisma.buktiPendukung.findMany({
      where: { userId },
    });

    // Kelompokkan dan hitung status
    const groups = new Map();
    for (const it of items) {
      let kode = 'UNK';
      if (typeof it.nama === 'string' && it.nama.includes('-')) {
        const parts = it.nama.split('-').map(s => s.trim());
        if (parts.length >= 2) kode = parts[0];
      }
      const key = kode;
      const current = groups.get(key) || { statusRaw: [] };
      current.statusRaw.push((it.status || '').toLowerCase());
      groups.set(key, current);
    }

    // Tentukan status tiap bagian
    let siapExport = 0;
    let belumLengkap = 0;
    for (const [key, group] of groups) {
      const allLower = group.statusRaw.map(s => String(s || '').toLowerCase());
      const allLengkap = allLower.every(s => s === 'lengkap' || s === 'complete' || s === 'siap export');
      if (allLengkap) siapExport++;
      else belumLengkap++;
    }

    const totalBagian = groups.size;
    const kelengkapan = totalBagian > 0 ? Math.round((siapExport / totalBagian) * 100) : 0;

    res.json({
      totalBagian,
      siapExport,
      belumLengkap,
      kelengkapan,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ message: 'Gagal mengambil statistik', error: error.message });
  }
};

// ---------- GET /api/akreditasi/items ----------
export const getItems = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User tidak terautentikasi' });
    }

    // Ambil data dari database menggunakan logic yang sama dengan getRekapBagian
    const items = await prisma.buktiPendukung.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    // Kelompokkan berdasarkan bagian
    const groups = new Map();

    for (const it of items) {
      let kode = 'UNK';
      let nama = 'Bagian Tidak Dikenal';
      let deskripsi = it.nama || 'Bukti pendukung';

      if (typeof it.nama === 'string' && it.nama.includes('-')) {
        const parts = it.nama.split('-').map(s => s.trim());
        if (parts.length >= 2) {
          kode = parts[0] || kode;
          nama = parts[1] || nama;
          deskripsi = parts.slice(2).join(' - ') || deskripsi;
        }
      }

      const key = `${kode}::${nama}`;
      const current = groups.get(key) || { 
        id: undefined, 
        kode_bagian: kode, 
        nama_bagian: nama, 
        deskripsi: '', 
        tanggal_update: undefined, 
        dokumen: [], 
        statusRaw: [] 
      };

      current.dokumen.push(it);
      current.statusRaw.push((it.status || '').toLowerCase());
      const ts = new Date(it.updatedAt || it.createdAt || Date.now()).toISOString();
      current.tanggal_update = !current.tanggal_update || ts > current.tanggal_update ? ts : current.tanggal_update;
      if (!current.deskripsi) current.deskripsi = deskripsi;

      groups.set(key, current);
    }

    // Tentukan status bagian
    const mapStatus = (statusList) => {
      if (!statusList || statusList.length === 0) return 'Kelengkapan';
      const allLower = statusList.map(s => String(s || '').toLowerCase());
      const allLengkap = allLower.every(s => s === 'lengkap' || s === 'complete' || s === 'siap export');
      return allLengkap ? 'Siap Export' : 'Belum Lengkap';
    };

    const result = [];
    let counter = 1;
    for (const [key, group] of groups) {
      result.push({
        id: counter++,
        kode_bagian: group.kode_bagian,
        nama_bagian: group.nama_bagian,
        deskripsi: group.deskripsi,
        tanggal_update: group.tanggal_update,
        status: mapStatus(group.statusRaw),
        dokumen: group.dokumen
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ message: 'Gagal mengambil data', error: error.message });
  }
};

// ---------- POST /api/akreditasi/export ----------
export const exportData = async (req, res) => {
  try {
    const { format, selectedIds } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userProdi = req.user?.prodi;
    
    if (!userId) {
      return res.status(401).json({ message: 'User tidak terautentikasi' });
    }

    console.log('🔵 EXPORT - User info:', { userId, userRole, userProdi });
    console.log('🔵 EXPORT - Request:', { format, selectedIds });

    // Ambil data tupoksi dari budaya_mutu table
    let whereClause = { type: 'tupoksi' };
    
    const normalizedRole = userRole ? userRole.trim().toLowerCase() : '';
    
    // Apply role-based filtering
    if (normalizedRole === 'tim-akreditasi' || normalizedRole === 'tim akreditasi') {
      // Tim Akreditasi dapat melihat semua data tupoksi (untuk export gabungan)
      // Tapi bisa juga filter by prodi mereka jika diperlukan
      if (userProdi) {
        // Uncomment line dibawah jika ingin Tim Akreditasi hanya export prodi mereka
        // whereClause.prodi = userProdi;
      }
    } else if (normalizedRole !== 'p4m') {
      // Other roles filter by user_id and prodi
      whereClause.user_id = userId;
      if (userProdi) {
        whereClause.prodi = userProdi;
      }
    }
    // P4M can see all data (no additional filter)

    console.log('🔵 EXPORT - Where clause:', whereClause);

    const tupoksiRecords = await prisma.budaya_mutu.findMany({
      where: whereClause,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        prodi: true,
        data: true,
        created_at: true,
        updated_at: true,
      },
    });

    console.log(`🔵 EXPORT - Found ${tupoksiRecords.length} records`);

    if (tupoksiRecords.length === 0) {
      return res.status(400).json({ message: "Tidak ada data tupoksi untuk di-export" });
    }

    // Flatten JSON data ke array of rows untuk Excel
    const excelData = [];
    
    tupoksiRecords.forEach((record) => {
      const jsonData = record.data;
      
      // Data tupoksi adalah object langsung, bukan array
      if (jsonData && typeof jsonData === 'object' && !Array.isArray(jsonData)) {
        excelData.push({
          'Prodi': record.prodi || '',
          'Unit Kerja': jsonData.unitKerja || '',
          'Nama Ketua': jsonData.namaKetua || '',
          'Periode': jsonData.periode || '',
          'Pendidikan Terakhir': jsonData.pendidikanTerakhir || jsonData.pendidikan || '',
          'Jabatan Fungsional': jsonData.jabatanFungsional || jsonData.jabatan || '',
          'Tugas Pokok dan Fungsi': jsonData.tugasPokokDanFungsi || jsonData.tupoksi || '',
        });
      }
    });

    console.log(`🔵 EXPORT - Processed ${excelData.length} rows`);

    if (excelData.length === 0) {
      return res.status(400).json({ message: "Tidak ada data tupoksi yang dapat di-export" });
    }

    const fileName = `tupoksi-export-${Date.now()}`;
    const exportDir = path.join(__dirname, "../exports");
    
    // Buat folder exports kalau belum ada
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    if (format.toLowerCase() === 'excel' || format.toLowerCase() === 'xlsx') {
      // Export ke Excel menggunakan XLSX
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tabel Tupoksi");

      // Set column widths
      const cols = [
        { wch: 20 },  // Prodi
        { wch: 25 },  // Unit Kerja
        { wch: 30 },  // Nama Ketua
        { wch: 15 },  // Periode
        { wch: 25 },  // Pendidikan Terakhir
        { wch: 25 },  // Jabatan Fungsional
        { wch: 50 },  // Tugas Pokok dan Fungsi
      ];
      worksheet['!cols'] = cols;

      const filePath = path.join(exportDir, `${fileName}.xlsx`);
      XLSX.writeFile(workbook, filePath);

      res.download(filePath, `${fileName}.xlsx`, (err) => {
        if (err) {
          console.error("Error sending file:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Gagal mengirim file" });
          }
        }
        // Hapus file setelah dikirim
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Error deleting file:", e);
        }
      });
    } else if (format.toLowerCase() === 'pdf') {
      // Untuk PDF, sementara kirim JSON (nanti bisa implement PDF generator)
      const filePath = path.join(exportDir, `${fileName}.pdf`);
      
      // Simple PDF generation (placeholder - implement proper PDF later)
      const pdfContent = `DATA TUPOKSI\n\n${JSON.stringify(excelData, null, 2)}`;
      fs.writeFileSync(filePath, pdfContent);

      res.download(filePath, `${fileName}.pdf`, (err) => {
        if (err) {
          console.error("Error sending file:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Gagal mengirim file" });
          }
        }
        // Hapus file setelah dikirim
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Error deleting file:", e);
        }
      });
    } else {
      res.status(400).json({ message: "Format tidak didukung. Gunakan Excel atau PDF." });
    }
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ message: "Gagal export data", error: error.message });
  }
};

// ---------- Upload Config ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `upload-${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// ---------- POST /api/akreditasi/upload ----------
export const uploadMiddleware = upload.single("document");

export const uploadDocument = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Tidak ada file yang diupload" });
  }
  res.json({
    message: "File berhasil diupload",
    file: req.file.filename,
  });
};

// ---------- GET /api/akreditasi/bagian ----------
export const getBagian = (req, res) => {
  res.json([
    {
      id: 1,
      kode_bagian: "A1",
      nama_bagian: "Visi & Misi",
      deskripsi: "Menjelaskan visi dan misi institusi",
      tanggal_update: "2025-01-10",
      status: "Siap Export",
    },
    {
      id: 2,
      kode_bagian: "B1",
      nama_bagian: "Kurikulum",
      deskripsi: "Struktur kurikulum dan capaian pembelajaran",
      tanggal_update: "2025-02-05",
      status: "Belum Lengkap",
    },
  ]);
};

// ---------- GET /api/akreditasi/templates ----------
export const getTemplates = (req, res) => {
  res.json([
    { id: 1, nama_template: "Template BAN-PT", jenis_template: "PDF" },
    { id: 2, nama_template: "Template Internal", jenis_template: "Excel" },
  ]);
};

// ---------- POST /api/akreditasi/tupoksi/save ----------
export const saveTupoksi = async (req, res) => {
  try {
    const { prodi, data } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userProdi = req.user?.prodi;

    if (!userId) {
      return res.status(401).json({ message: 'User tidak terautentikasi' });
    }

    // Validasi input
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ message: 'Data tupoksi harus berupa array' });
    }

    // Tentukan prodi yang akan disimpan
    let targetProdi = prodi;
    const normalizedRole = userRole ? userRole.trim().toLowerCase() : '';

    // Role validation
    if (normalizedRole === 'tim-akreditasi' || normalizedRole === 'tim akreditasi') {
      // Tim Akreditasi hanya bisa save untuk prodi mereka sendiri
      if (!userProdi) {
        return res.status(403).json({ message: "Prodi pengguna tidak ditemukan" });
      }
      targetProdi = userProdi; // Override dengan prodi user
    } else if (normalizedRole !== 'p4m') {
      // Other roles (non P4M) also use their own prodi
      if (!userProdi) {
        return res.status(403).json({ message: "Prodi pengguna tidak ditemukan" });
      }
      targetProdi = userProdi;
    }

    if (!targetProdi) {
      return res.status(400).json({ message: 'Prodi tidak boleh kosong' });
    }

    // Cek apakah sudah ada data tupoksi untuk prodi ini
    const existingRecord = await prisma.budaya_mutu.findFirst({
      where: {
        user_id: userId,
        prodi: targetProdi,
        type: 'tupoksi',
      },
    });

    let result;

    if (existingRecord) {
      // UPDATE existing record
      result = await prisma.budaya_mutu.update({
        where: { id: existingRecord.id },
        data: {
          data: data, // JSON field
          updated_at: new Date(),
        },
      });
    } else {
      // CREATE new record
      result = await prisma.budaya_mutu.create({
        data: {
          user_id: userId,
          prodi: targetProdi,
          type: 'tupoksi',
          data: data, // JSON field
        },
      });
    }

    res.json({
      success: true,
      message: existingRecord ? 'Data tupoksi berhasil diperbarui' : 'Data tupoksi berhasil disimpan',
      data: result,
    });
  } catch (error) {
    console.error("Save tupoksi error:", error);
    res.status(500).json({ 
      success: false,
      message: "Gagal menyimpan data tupoksi", 
      error: error.message 
    });
  }
};

// ---------- GET /api/akreditasi/tupoksi ----------
export const getTupoksi = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userProdi = req.user?.prodi;
    const { prodi } = req.query; // Optional prodi filter for P4M

    if (!userId) {
      return res.status(401).json({ message: 'User tidak terautentikasi' });
    }

    let whereClause = { type: 'tupoksi' };
    const normalizedRole = userRole ? userRole.trim().toLowerCase() : '';

    // Apply role-based filtering
    if (normalizedRole === 'tim-akreditasi' || normalizedRole === 'tim akreditasi') {
      if (!userProdi) {
        return res.status(403).json({ message: "Prodi pengguna tidak ditemukan" });
      }
      whereClause.prodi = userProdi;
      whereClause.user_id = userId;
    } else if (normalizedRole === 'p4m') {
      // P4M can view all, but can filter by prodi if provided
      if (prodi) {
        whereClause.prodi = prodi;
      }
    } else {
      // Other roles filter by user_id and prodi
      whereClause.user_id = userId;
      if (userProdi) {
        whereClause.prodi = userProdi;
      }
    }

    const tupoksiRecords = await prisma.budaya_mutu.findMany({
      where: whereClause,
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        prodi: true,
        data: true,
        created_at: true,
        updated_at: true,
      },
    });

    res.json({
      success: true,
      data: tupoksiRecords,
    });
  } catch (error) {
    console.error("Get tupoksi error:", error);
    res.status(500).json({ 
      success: false,
      message: "Gagal mengambil data tupoksi", 
      error: error.message 
    });
  }
};

// ---------- DELETE /api/akreditasi/tupoksi/:id ----------
export const deleteTupoksi = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ message: 'User tidak terautentikasi' });
    }

    // Cek apakah record exists dan milik user ini
    const record = await prisma.budaya_mutu.findUnique({
      where: { id: parseInt(id) },
    });

    if (!record) {
      return res.status(404).json({ message: 'Data tupoksi tidak ditemukan' });
    }

    // Only allow deletion if user owns the record or is P4M
    const normalizedRole = userRole ? userRole.trim().toLowerCase() : '';
    if (record.user_id !== userId && normalizedRole !== 'p4m') {
      return res.status(403).json({ message: 'Tidak memiliki akses untuk menghapus data ini' });
    }

    await prisma.budaya_mutu.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'Data tupoksi berhasil dihapus',
    });
  } catch (error) {
    console.error("Delete tupoksi error:", error);
    res.status(500).json({ 
      success: false,
      message: "Gagal menghapus data tupoksi", 
      error: error.message 
    });
  }
};

