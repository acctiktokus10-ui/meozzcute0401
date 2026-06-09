// pages/api/process-csv.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { csvText } = req.body;
    if (!csvText) return res.status(400).json({ error: 'Thiếu dữ liệu CSV' });

    const lines = csvText.split('\n').filter(l => l.trim());
    const headerLine = lines[0].replace(/^\uFEFF/, '');
    const headers = parseCSVLine(headerLine);
    const col = name => headers.indexOf(name);

    const IDX = {
      id:          col('ID đơn hàng'),
      trangThai:   col('Trạng thái đặt hàng'),
      thoiGianDat: col('Thời Gian Đặt Hàng'),
      thoiGianHT:  col('Thời gian hoàn thành'),
      tenItem:     col('Tên Item'),
      hoaHongRong: col('Hoa hồng ròng tiếp thị liên kết(₫)'),
      tongHoaDon:  col('Tổng hoa hồng đơn hàng(₫)'),
      subId1:      col('Sub_id1'),
    };

    // donMap: idDon -> đơn hàng
    const donMap = {};

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 10) continue;

      const subId = cols[IDX.subId1]?.trim();
      if (!subId) continue;

      const idDon      = cols[IDX.id]?.trim();
      const trangThai  = cols[IDX.trangThai]?.trim();
      const ngayDat    = cols[IDX.thoiGianDat]?.trim() || '';
      const ngayHT     = cols[IDX.thoiGianHT]?.trim() || '';
      const tenItem    = cols[IDX.tenItem]?.trim() || '';
      const hoaHong    = parseFloat(cols[IDX.hoaHongRong]) || 0;
      const tongHoaDon = parseFloat(cols[IDX.tongHoaDon]) || 0;

      if (!idDon) continue;

      // Tạo đơn nếu chưa có
      if (!donMap[idDon]) {
        donMap[idDon] = {
          sub_id: subId,
          id_don_hang: idDon,
          trang_thai: trangThai,
          ngay_dat_hang: ngayDat,
          ngay_hoan_thanh: (ngayHT && ngayHT !== '--') ? ngayHT : '--',
          hoa_hong_rong: 0,
          ten_san_pham: '',
          ten_san_pham_rut_gon: '',
          tong_pct_hoa_hong: '100.00%',
          da_co_hoa_hong: false,
        };
      }

      // Hoa hồng đơn: CHỈ lấy dòng có Tổng hoa hồng đơn hàng > 0
      // Dòng đó chứa hoa hồng ròng đúng của cả đơn
      if (tongHoaDon > 0 && !donMap[idDon].da_co_hoa_hong) {
        donMap[idDon].hoa_hong_rong = hoaHong;
        donMap[idDon].da_co_hoa_hong = true;
        // Lấy tên SP từ dòng này
        if (tenItem) {
          donMap[idDon].ten_san_pham = tenItem;
          donMap[idDon].ten_san_pham_rut_gon = tenItem.length > 20
            ? tenItem.substring(0, 20) + '...' : tenItem;
        }
      }

      // Fallback tên SP nếu chưa có
      if (!donMap[idDon].ten_san_pham && tenItem) {
        donMap[idDon].ten_san_pham = tenItem;
        donMap[idDon].ten_san_pham_rut_gon = tenItem.length > 20
          ? tenItem.substring(0, 20) + '...' : tenItem;
      }
    }

    // Build donhang_by_subid
    const donhangMap = {};
    for (const don of Object.values(donMap)) {
      const sid = don.sub_id;
      if (!donhangMap[sid]) {
        donhangMap[sid] = { sub_id: sid, tong_so_don: 0, tong_hoa_hong: 0, don_hang: [] };
      }
      if (don.trang_thai === 'Hoàn thành') {
        donhangMap[sid].tong_so_don += 1;
        donhangMap[sid].tong_hoa_hong += don.hoa_hong_rong;
      }
      donhangMap[sid].don_hang.push({
        id_don_hang: don.id_don_hang,
        ten_san_pham: don.ten_san_pham,
        ten_san_pham_rut_gon: don.ten_san_pham_rut_gon,
        trang_thai: don.trang_thai,
        tong_pct_hoa_hong: don.tong_pct_hoa_hong,
        hoa_hong_rong: Math.round(don.hoa_hong_rong * 100) / 100,
        ngay_dat_hang: don.ngay_dat_hang,
        ngay_hoan_thanh: don.ngay_hoan_thanh,
      });
    }
    for (const v of Object.values(donhangMap)) {
      v.tong_hoa_hong = Math.round(v.tong_hoa_hong * 100) / 100;
    }

    // Build vitien_by_subid
    const vitienMap = {};
    for (const don of Object.values(donMap)) {
      const sid = don.sub_id;
      if (!vitienMap[sid]) {
        vitienMap[sid] = { sub_id: sid, dang_cho: 0, don_hoan_thanh: [] };
      }
      if (don.trang_thai === 'Đang chờ xử lý' && don.hoa_hong_rong > 0) {
        vitienMap[sid].dang_cho += don.hoa_hong_rong;
      }
      if (don.trang_thai === 'Hoàn thành' && don.hoa_hong_rong > 0) {
        vitienMap[sid].don_hoan_thanh.push({
          id_don_hang: don.id_don_hang,
          ten_san_pham: don.ten_san_pham,
          ten_san_pham_rut_gon: don.ten_san_pham_rut_gon,
          trang_thai: don.trang_thai,
          tong_pct_hoa_hong: don.tong_pct_hoa_hong,
          hoa_hong_rong: Math.round(don.hoa_hong_rong * 100) / 100,
          ngay_dat_hang: don.ngay_dat_hang,
          ngay_hoan_thanh: don.ngay_hoan_thanh,
        });
      }
    }
    for (const v of Object.values(vitienMap)) {
      v.dang_cho = Math.round(v.dang_cho * 100) / 100;
    }

    return res.status(200).json({ donhang: donhangMap, vitien: vitienMap });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}
