import prisma from "../prismaClient.js";
import multer from "multer";
import xlsx from "xlsx";
import path from "path";
import fs from "fs";
import { createOrUpdateBuktiPendukung } from '../controllers/buktiPendukungController.js';

const upload = multer({ storage: multer.memoryStorage() });

// ======================
// 🟦 GET DATA BY TYPE
// ======================
export const getData = async (req, res) => {
  const { type, prodi } = req.query; // Changed prodiFilter to prodi
  try {
      const user_id = req.user.id;
      const user_prodi = req.user.prodi; // Get prodi from authenticated user
      const user_role = req.user.role; // Get user role

      let whereClause = { type }; // Start with type filter

      const normalizedRole = user_role ? user_role.trim().toLowerCase() : '';
      
      if (normalizedRole === 'tim akreditasi') {
        // Tim Akreditasi can ONLY view data for their own prodi
        if (!user_prodi) {
          return res.status(403).json({ success: false, message: "Prodi pengguna tidak ditemukan." });
        }
        whereClause.prodi = user_prodi;
      } else if (normalizedRole === 'p4m') {
        // P4M can view all data, but can also filter by prodi if 'prodi' query param is provided
        if (prodi) { // Use 'prodi' from query
          whereClause.prodi = prodi;
        }
      } else {
        // Other roles always filter by their user_id AND their prodi
        whereClause.user_id = user_id;
        if (!user_prodi) {
          return res.status(403).json({ success: false, message: "Prodi pengguna tidak ditemukan." });
        }
        whereClause.prodi = user_prodi;
      }
  
      const data = await prisma.budaya_mutu.findMany({
        where: whereClause,
        orderBy: { id: "asc" },
        select: {
          id: true,
          type: true,
          prodi: true, // Select the prodi field
          data: true,
          created_at: true,
          updated_at: true,
        },    });

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal mengambil data" });
  }
};


/* =============================================
   GET DISTINCT PRODI
============================================= */
export const getDistinctProdi = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const userProdi = req.user.prodi;

    let whereClause = {};
    const normalizedUserRole = userRole ? userRole.trim().toLowerCase() : '';

    if (normalizedUserRole !== 'tim akreditasi') {
      // For non-admin roles, filter by user's prodi
      if (userProdi) {
        whereClause = { prodi: userProdi };
      } else {
        // If not admin and no user prodi, return empty
        return res.json({ success: true, data: [] });
      }
    }

    const distinctProdi = await prisma.budaya_mutu.findMany({
      where: whereClause,
      distinct: ['prodi'],
      select: {
        prodi: true,
      },
    });

    const prodiOptions = distinctProdi.map(item => item.prodi).filter(Boolean);

    res.json({ success: true, data: prodiOptions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal mengambil opsi prodi", error: err.message });
  }
};

// ======================
// 🟩 CREATE DATA
// ======================
export const createData = async (req, res) => {
  const { type, data, prodi } = req.body; // Destructure prodi from req.body
  const user_id = req.user.id;
  const user_prodi = req.user.prodi; // Get prodi from authenticated user

  const final_prodi = prodi || user_prodi; // Use prodi from body or user's prodi as fallback

  if (!final_prodi) {
    return res.status(400).json({ success: false, message: "Prodi tidak ditemukan" });
  }

  console.log("CREATE DATA - Received:", { type, data, user_id, final_prodi });

  try {
    // ✅ Handle array data: jika data adalah array, normalize setiap item
    let cleanData;
    if (Array.isArray(data)) {
      cleanData = data.map(item => normalizeRow(item));
    } else {
      // Fallback untuk backward compatibility dengan single object
      cleanData = normalizeRow(data);
    }
    
    console.log("CREATE DATA - Cleaned data:", cleanData);

    const created = await prisma.budaya_mutu.create({
      data: {
        user_id,
        type,
        prodi: final_prodi, // Include prodi here
        data: cleanData,
      },
    });

    console.log("CREATE DATA - Created successfully:", created);
    res.json({ success: true, data: created });
  } catch (err) {
    console.error("CREATE ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal menyimpan data" });
  }
};

// ======================
// 🟧 UPDATE DATA
// ======================
export const updateData = async (req, res) => {
  const { id } = req.params;
  const { type, data, prodi } = req.body; // Destructure prodi from req.body

  try {
    const cleanData = normalizeRow(data);

    const updated = await prisma.budaya_mutu.update({
      where: { id: Number(id) },
      data: {
        type,
        prodi: prodi, // Update prodi field
        data: cleanData,
        updated_at: new Date(),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal update data" });
  }
};

// ======================
// 🟥 DELETE DATA
// ======================
export const deleteData = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.budaya_mutu.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: "Data berhasil dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal hapus data" });
  }
};

/* =============================================
   SUBTAB FIELDS DEFINITION
============================================= */
const subtabFields = {
  'tupoksi': [
    { key: 'unitKerja', label: 'Unit Kerja' },
    { key: 'namaKetua', label: 'Nama Ketua' },
    { key: 'periode', label: 'Periode' },
    { key: 'pendidikanTerakhir', label: 'Pendidikan Terakhir' },
    { key: 'jabatanFungsional', label: 'Jabatan Fungsional' },
    { key: 'tugasPokokDanFungsi', label: 'Tugas Pokok dan Fungsi' },
  ],
  'pendanaan': [
    { key: 'sumberPendanaan', label: 'Sumber Pendanaan' },
    { key: 'ts2', label: 'TS-2' },
    { key: 'ts1', label: 'TS-1' },
    { key: 'ts', label: 'TS' },
    { key: 'linkBukti', label: 'Link Bukti' },
  ],
  'penggunaan-dana': [
    { key: 'penggunaanDana', label: 'Penggunaan Dana' },
    { key: 'ts2', label: 'TS-2' },
    { key: 'ts1', label: 'TS-1' },
    { key: 'ts', label: 'TS' },
    { key: 'linkBukti', label: 'Link Bukti' },
  ],
  'ewmp': [
    { key: 'namaDTPR', label: 'Nama DTPR' },
    { key: 'psSendiri', label: 'PS Sendiri' },
    { key: 'psLainPTSendiri', label: 'PS Lain PT Sendiri' },
    { key: 'ptLain', label: 'PT Lain' },
    { key: 'sksPenelitian', label: 'SKS Penelitian' },
    { key: 'sksPengabdian', label: 'SKS Pengabdian' },
    { key: 'manajemenPTSendiri', label: 'Manajemen PT Sendiri' },
    { key: 'manajemenPTLain', label: 'Manajemen PT Lain' },
    { key: 'totalSKS', label: 'Total SKS' },
  ],
  'ktk': [
    { key: 'jenisTenagaKependidikan', label: 'Jenis Tenaga Kependidikan' },
    { key: 's3', label: 'S3' },
    { key: 's2', label: 'S2' },
    { key: 's1', label: 'S1' },
    { key: 'd4', label: 'D4' },
    { key: 'd3', label: 'D3' },
    { key: 'd2', label: 'D2' },
    { key: 'd1', label: 'D1' },
    { key: 'sma', label: 'SMA' },
    { key: 'unitKerja', label: 'Unit Kerja' },
  ],
  'spmi': [
    { key: 'unitSPMI', label: 'Unit SPMI' },
    { key: 'namaUnitSPMI', label: 'Nama Unit SPMI' },
    { key: 'dokumenSPMI', label: 'Dokumen SPMI' },
    { key: 'jumlahAuditorMutuInternal', label: 'Jumlah Auditor Mutu Internal' },
    { key: 'certified', label: 'Certified' },
    { key: 'nonCertified', label: 'Non Certified' },
    { key: 'frekuensiAudit', label: 'Frekuensi Audit' },
    { key: 'buktiCertifiedAuditor', label: 'Bukti Certified Auditor' },
    { key: 'laporanAudit', label: 'Laporan Audit' },
  ],
};

/* =============================================
   PREVIEW EXCEL - NEW ENDPOINT
============================================= */
export const previewExcel = [
  upload.single("file"),
  async (req, res) => {
    try {
      const type = req.params.type;

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: "File tidak ditemukan" 
        });
      }

      // Parse Excel
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "File Excel kosong"
        });
      }

      // Get headers from first row
      const headers = Object.keys(rows[0]);
      
      // Generate suggestions based on field matching
      const suggestions = generateSuggestions(headers, type);

      console.log("PREVIEW - Headers:", headers);
      console.log("PREVIEW - Suggestions:", suggestions);

      res.json({
        success: true,
        headers,
        rows: rows.slice(0, 5), // Preview first 5 rows
        suggestions,
        totalRows: rows.length
      });

    } catch (err) {
      console.error("PREVIEW ERROR:", err);
      res.status(500).json({ 
        success: false, 
        message: "Gagal memproses file Excel",
        error: err.message 
      });
    }
  }
];

/* =============================================
   IMPORT EXCEL - UPDATED
============================================= */
export const importExcel = [
  upload.single("file"),
  async (req, res) => {
    try {
      const type = req.params.type;
      const user_id = req.user.id;
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: "File tidak ditemukan" 
        });
      }

      // Parse mapping from request body
      let mapping = {};
      if (req.body.mapping) {
        try {
          mapping = JSON.parse(req.body.mapping);
          console.log("IMPORT - Mapping received:", mapping);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Format mapping tidak valid"
          });
        }
      }

      
      // Parse Excel
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
      
      console.log('row: ', rows);
      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "File Excel kosong"
        });
      }

      console.log("IMPORT - Processing", rows.length, "rows");

      let added = 0;
      let errors = [];

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        try {
          const rawRow = rows[i];
          const mappedData = {};

          // Get prodi for this record. Prioritize mapped 'prodi' from Excel, then fallback to user's prodi.
          let record_prodi = req.user.prodi; 
          if (mapping.prodi && rawRow.hasOwnProperty(mapping.prodi)) {
            record_prodi = rawRow[mapping.prodi];
          }

          if (!record_prodi) {
             errors.push({ 
              row: i + 1, 
              error: `Prodi tidak ditemukan untuk baris ini.` 
            });
            continue;
          }

          // Map Excel columns to database fields, excluding 'prodi' from the data JSON
          Object.entries(mapping).forEach(([dbField, excelColumn]) => {
            if (dbField !== 'prodi' && excelColumn && rawRow.hasOwnProperty(excelColumn)) { // Exclude 'prodi' from data JSON
              mappedData[dbField] = rawRow[excelColumn];
            }
          });

          console.log(`IMPORT - Row ${i + 1} mapped:`, mappedData, `Prodi: ${record_prodi}`);

          // Validate required fields
          const fields = subtabFields[type] || [];
          const missingFields = fields
            .filter(field => !mappedData[field.key] || mappedData[field.key] === '')
            .map(field => field.label);
          
          console.log("missing: ", missingFields);

          if (missingFields.length > 0) {
            errors.push({ 
              row: i + 1, 
              error: `Field wajib kosong: ${missingFields.join(', ')}` 
            });
            continue;
          }

          const cleanData = normalizeRow(mappedData);

          // Save to database
          await prisma.budaya_mutu.create({
            data: {
              user_id,
              type,
              prodi: record_prodi, // Include the determined prodi
              data: cleanData,
            },
          });

          added++;
        } catch (e) {
          console.error(`IMPORT - Error on row ${i + 1}:`, e);
          errors.push({ 
            row: i + 1, 
            error: e.message 
          });
        }
      }

      console.log("IMPORT - Complete:", { added, failed: errors.length });

      res.json({
        success: true,
        message: `Import selesai: ${added} berhasil, ${errors.length} gagal`,
        added,
        failed: errors.length,
        errors: errors.slice(0, 10) // Return max 10 errors
      });

    } catch (err) {
      console.error("IMPORT ERROR:", err);
      res.status(500).json({ 
        success: false, 
        message: "Gagal import data",
        error: err.message 
      });
    }
  },
];

/* =============================================
   HELPER: GENERATE SUGGESTIONS
============================================= */
function generateSuggestions(headers, type) {
  const suggestions = {};
  const fields = subtabFields[type] || [];

  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()]/g, '')
      .replace(/-/g, '');

    for (const field of fields) {
      const normalizedKey = field.key.toLowerCase();
      const normalizedLabel = field.label.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[()]/g, '')
        .replace(/-/g, '');

      // Exact match
      if (normalizedHeader === normalizedKey || normalizedHeader === normalizedLabel) {
        suggestions[field.key] = header;
        break;
      }

      // Partial match
      if (normalizedHeader.includes(normalizedKey) || 
          normalizedLabel.includes(normalizedHeader)) {
        if (!suggestions[field.key]) { // Don't override exact matches
          suggestions[field.key] = header;
        }
      }
    }
  });

  return suggestions;
}

/* =============================================
   NORMALIZATION & FILTER
============================================= */
function normalizeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === 'string') return value.trim();
  return value;
}

function normalizeRow(row = {}) {
  const result = {};
  for (const key of Object.keys(row)) {
    result[key] = normalizeValue(row[key]);
  }
  return result;
}

// ======================================================
// 🏗 STRUKTUR ORGANISASI (CRUD FILE)
// ======================================================

// UPLOAD FILE STRUKTUR
export const uploadStruktur = async (req, res) => {
  const file = req.file;

  if (!file)
    return res.status(400).json({ success: false, message: "Tidak ada file diunggah" });

  try {
    const saved = await prisma.struktur_files.create({
      data: {
        nama_file: file.originalname,
        file_path: file.path,
      },
    });

    res.json({
      success: true,
      message: "File berhasil diupload",
      fileId: saved.id,
      fileName: file.originalname,
      fileUrl: `/uploads/struktur/${path.basename(file.path)}`,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal upload file" });
  }
};

// GET TERBARU
export const getStruktur = async (req, res) => {
  try {
    const file = await prisma.struktur_files.findFirst({
      orderBy: {
        created_at: "desc",
      },
    });

    if (!file) return res.json({ success: true, file: null });

    res.json({
      success: true,
      file: {
        id: file.id,
        fileName: file.nama_file,
        fileUrl: `/uploads/struktur/${path.basename(file.file_path)}`,
        createdAt: file.created_at,
      },
    });
  } catch (err) {
    console.error("GET ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal mengambil file" });
  }
};

// UPDATE FILE STRUKTUR
export const updateStruktur = async (req, res) => {
  const { id } = req.params;
  const file = req.file;

  try {
    const old = await prisma.struktur_files.findUnique({
      where: { id: Number(id) },
    });

    if (!old)
      return res.status(404).json({ success: false, message: "File tidak ditemukan" });

    if (fs.existsSync(old.file_path)) {
      fs.unlinkSync(old.file_path);
    }

    await prisma.struktur_files.update({
      where: { id: Number(id) },
      data: {
        nama_file: file.originalname,
        file_path: file.path,
        created_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: "File berhasil diupdate",
      fileName: file.originalname,
      fileUrl: `/uploads/struktur/${path.basename(file.path)}`,
    });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal update file" });
  }
};

// DELETE FILE
export const deleteStruktur = async (req, res) => {
  const { id } = req.params;

  try {
    const file = await prisma.struktur_files.findUnique({
      where: { id: Number(id) },
    });

    if (!file)
      return res.status(404).json({ success: false, message: "File tidak ditemukan" });

    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    await prisma.struktur_files.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: "File berhasil dihapus" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal menghapus file" });
  }
};

// ======================
// 📝 SAVE DRAFT (Budaya Mutu Specific with Bukti Pendukung Reference)
// ======================
export const saveDraft = async (req, res) => {
  const { nama, path, status, type, currentData } = req.body;
  const user_id = req.user.id;
  const user_prodi = req.user.prodi;

  // Basic validation
  if (!nama || !path || !status || !type || !currentData) {
    return res.status(400).json({ success: false, message: "Nama, path, status, type, dan data tidak boleh kosong" });
  }
  if (!user_id || !user_prodi) {
    return res.status(401).json({ success: false, message: "User tidak terautentikasi atau prodi tidak ditemukan" });
  }

  try {
    // 1. Save/Update detailed Budaya Mutu data (treating it as the draft)
    const existingBudayaMutuEntry = await prisma.budaya_mutu.findFirst({
      where: {
        user_id: user_id,
        prodi: user_prodi,
        type: type,
      },
    });

    let savedBudayaMutu;
    if (existingBudayaMutuEntry) {
      savedBudayaMutu = await prisma.budaya_mutu.update({
        where: { id: existingBudayaMutuEntry.id },
        data: {
          data: currentData, // Update the data field with the new draft content
          updated_at: new Date(),
        },
      });
    } else {
      savedBudayaMutu = await prisma.budaya_mutu.create({
        data: {
          user_id: user_id,
          prodi: user_prodi,
          type: type,
          data: currentData,
        },
      });
    }

    // 2. Create/Update a reference in Bukti Pendukung
    // We need to simulate req, res objects for createOrUpdateBuktiPendukung
    const buktiPendukungReq = {
      body: { nama, path, status },
      user: req.user,
    };
    const buktiPendukungRes = {
      status: (code) => ({ json: (data) => ({ code, data }) }), // Mock response
      json: (data) => ({ code: 200, data }), // Mock response
    };

    // Call the original createOrUpdateBuktiPendukung logic directly
    // This requires a slight refactor in createOrUpdateBuktiPendukung to not use res directly for success paths
    // For now, I'll directly replicate the create/update logic here.
    const existingBukti = await prisma.buktiPendukung.findFirst({
      where: {
        userId: user_id,
        path: path,
      },
    });

    let buktiPendukungEntry;
    if (existingBukti) {
      buktiPendukungEntry = await prisma.buktiPendukung.update({
        where: { id: existingBukti.id },
        data: { status: status },
      });
    } else {
      buktiPendukungEntry = await prisma.buktiPendukung.create({
        data: {
          nama: nama,
          path: path,
          status: status,
          userId: user_id,
        },
      });
    }

    res.json({ 
      success: true, 
      message: "Draft Budaya Mutu berhasil disimpan dan referensi Bukti Pendukung diperbarui", 
      budayaMutuDraft: savedBudayaMutu,
      buktiPendukungReference: buktiPendukungEntry
    });

  } catch (err) {
    console.error("SAVE DRAFT BUDAYA MUTU ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal menyimpan draft Budaya Mutu" });
  }
};
