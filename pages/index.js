import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

export default function Home() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [status, setStatus] = useState({ donhang: null, vitien: null })
  const [reloadLoading, setReloadLoading] = useState(false)
  const [reloadMsg, setReloadMsg] = useState('')

  const [csvFile, setCsvFile] = useState(null)
  const [csvProcessing, setCsvProcessing] = useState(false)
  const [csvResult, setCsvResult] = useState(null)
  const [csvError, setCsvError] = useState('')
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvUploadMsg, setCsvUploadMsg] = useState('')
  const csvRef = useRef()
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    const p = localStorage.getItem('zalo_pwd')
    if (p) {
      setPassword(p)
      // Xác thực lại với server
      fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: p, type: 'ping', data: {} }),
      }).then(res => {
        if (res.status !== 401) { setAuthed(true) }
        else { localStorage.removeItem('zalo_pwd') }
      }).catch(() => { setAuthed(true) }) // offline -> cho vào
    }
  }, [])

  useEffect(() => { if (authed) fetchStatus() }, [authed])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/status')
      const d = await res.json()
      setStatus(d)
    } catch {}
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, type: 'ping', data: {} }),
      })
      if (res.status === 401) {
        setLoginError('Mật khẩu không đúng, vui lòng thử lại!')
        setLoginLoading(false)
        return
      }
      setAuthed(true)
      localStorage.setItem('zalo_pwd', password)
    } catch (err) {
      setLoginError('Lỗi kết nối, thử lại!')
    }
    setLoginLoading(false)
  }

  function handleLogout() {
    setAuthed(false)
    localStorage.removeItem('zalo_pwd')
    setPassword('')
  }

  async function handleReload() {
    setReloadLoading(true)
    setReloadMsg('⏳ Đang gửi lệnh đến bot...')
    try {
      const res = await fetch('/api/reload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await res.json()
      if (!res.ok) { setReloadMsg(`❌ ${result.error}`); setReloadLoading(false); return }
      setReloadMsg('⏳ Bot đang tải dữ liệu...')
      const MAX_WAIT = 60, INTERVAL = 2
      for (let i = 0; i < MAX_WAIT / INTERVAL; i++) {
        await new Promise(r => setTimeout(r, INTERVAL * 1000))
        try {
          const poll = await fetch('/api/reload?poll_status=1')
          const s = await poll.json()
          if (s.state === 'success') {
            setReloadMsg(`✅ Bot đã tải xong! ${s.donhang_count ?? 0} đơn hàng, ${s.vitien_count ?? 0} ví tiền`)
            fetchStatus(); setReloadLoading(false); return
          }
          if (s.state === 'error') { setReloadMsg(`❌ ${s.message}`); setReloadLoading(false); return }
          if (s.state === 'loading') setReloadMsg(`⏳ Bot đang tải... (lần ${s.attempt ?? '?'}/${s.max_attempts ?? '?'})`)
          else if (s.state === 'retrying') setReloadMsg(`🔄 ${s.message}`)
        } catch (_) {}
      }
      setReloadMsg('⚠️ Chờ quá 60 giây — kiểm tra log bot nhé!')
    } catch (err) { setReloadMsg(`❌ Lỗi: ${err.message}`) }
    setReloadLoading(false)
  }

  async function handleCsvProcess() {
    if (!csvFile) return
    setCsvProcessing(true)
    setCsvError('')
    setCsvResult(null)
    setCsvUploadMsg('')
    try {
      const text = await csvFile.text()
      const data = processCsvClient(text)
      setCsvResult(data)
    } catch (e) { setCsvError(e.message) }
    setCsvProcessing(false)
  }

  async function handleCsvSendBot() {
    if (!csvResult) return
    setCsvUploading(true)
    setCsvUploadMsg('')
    setCsvError('')
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, type: 'donhang', data: csvResult.donhang }),
        }),
        fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, type: 'vitien', data: csvResult.vitien }),
        }),
      ])
      if (!r1.ok || !r2.ok) throw new Error('Upload thất bại, kiểm tra mật khẩu')
      setCsvUploadMsg('✅ Đã upload lên Redis thành công!')
      fetchStatus()
    } catch (e) { setCsvError(e.message) }
    setCsvUploading(false)
  }

  function fmtDate(iso) {
    if (!iso) return 'Chưa có dữ liệu'
    return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  }

  const donhangCount = csvResult ? Object.keys(csvResult.donhang).length : 0
  const vitienCount  = csvResult ? Object.keys(csvResult.vitien).length  : 0

  if (!authed) return (
    <>
      <Head><title>MeozzCute</title></Head>
      <div className="login-wrap">
        <div className="login-card">
          <div className="logo">
            <svg viewBox="0 0 100 100" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="48" fill="#fff" stroke="#ffb7c5" strokeWidth="3"/>
              {/* Head */}
              <ellipse cx="50" cy="52" rx="34" ry="32" fill="#fff"/>
              {/* Ears */}
              <ellipse cx="22" cy="26" rx="10" ry="12" fill="#fff" stroke="#ffb7c5" strokeWidth="2"/>
              <ellipse cx="78" cy="26" rx="10" ry="12" fill="#fff" stroke="#ffb7c5" strokeWidth="2"/>
              <ellipse cx="22" cy="26" rx="5" ry="7" fill="#ffb7c5"/>
              <ellipse cx="78" cy="26" rx="5" ry="7" fill="#ffb7c5"/>
              {/* Eyes */}
              <ellipse cx="38" cy="50" rx="6" ry="7" fill="#1a1a1a"/>
              <ellipse cx="62" cy="50" rx="6" ry="7" fill="#1a1a1a"/>
              <circle cx="40" cy="48" r="2" fill="#fff"/>
              <circle cx="64" cy="48" r="2" fill="#fff"/>
              {/* Nose */}
              <ellipse cx="50" cy="60" rx="3" ry="2" fill="#ffb7c5"/>
              {/* Whiskers */}
              <line x1="14" y1="58" x2="42" y2="62" stroke="#ccc" strokeWidth="1.5"/>
              <line x1="14" y1="63" x2="42" y2="65" stroke="#ccc" strokeWidth="1.5"/>
              <line x1="58" y1="62" x2="86" y2="58" stroke="#ccc" strokeWidth="1.5"/>
              <line x1="58" y1="65" x2="86" y2="63" stroke="#ccc" strokeWidth="1.5"/>
              {/* Bow */}
              <polygon points="58,28 70,22 70,34" fill="#ff6b9d"/>
              <polygon points="82,28 70,22 70,34" fill="#ff6b9d"/>
              <circle cx="70" cy="28" r="4" fill="#ff3d7f"/>
            </svg>
          </div>
          <h1>MeozzCute 🎀</h1>
          <p className="sub">Nhập mật khẩu để tiếp tục</p>
          <form onSubmit={handleLogin}>
            <input type="password" placeholder="Mật khẩu" value={password}
              onChange={e => { setPassword(e.target.value); setLoginError('') }} autoFocus required />
            {loginError && <p className="login-err">{loginError}</p>}
            <button type="submit" disabled={loginLoading}>
              {loginLoading ? '⏳ Đang kiểm tra...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
        .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#fff0f6,#fce4ec,#f8f0ff)}
        .login-card{background:#fff;border-radius:24px;padding:48px 36px;width:100%;max-width:380px;text-align:center;box-shadow:0 8px 32px rgba(255,105,180,0.15);border:1px solid #ffe4f0}
        .logo{font-size:48px;margin-bottom:12px;display:flex;justify-content:center}
        h1{color:#d63384;font-size:24px;font-weight:700;margin-bottom:6px}
        .sub{color:#f48fb1;font-size:14px;margin-bottom:28px}
        input{width:100%;padding:14px 16px;background:#fff0f6;border:1.5px solid #ffb7c5;border-radius:12px;color:#1e293b;font-size:15px;margin-bottom:14px;outline:none}
        input:focus{border-color:#d63384}
        button{width:100%;padding:14px;background:linear-gradient(135deg,#ff6b9d,#d63384);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:700;cursor:pointer}
        button:disabled{opacity:.6;cursor:not-allowed}
        .login-err{color:#dc2626;font-size:13px;margin-bottom:12px;background:#fef2f2;padding:10px;border-radius:8px;border:1px solid #fecaca}
      `}</style>
    </>
  )

  return (
    <>
      <Head><title>MeozzCute</title></Head>
      <div className="wrap">
        <header>
          <div className="inner">
            <div className="hd-left">
              <span className="logo">
                <svg viewBox="0 0 100 100" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="48" fill="#fff" stroke="#ffb7c5" strokeWidth="3"/>
                  <ellipse cx="50" cy="52" rx="34" ry="32" fill="#fff"/>
                  <ellipse cx="22" cy="26" rx="10" ry="12" fill="#fff" stroke="#ffb7c5" strokeWidth="2"/>
                  <ellipse cx="78" cy="26" rx="10" ry="12" fill="#fff" stroke="#ffb7c5" strokeWidth="2"/>
                  <ellipse cx="22" cy="26" rx="5" ry="7" fill="#ffb7c5"/>
                  <ellipse cx="78" cy="26" rx="5" ry="7" fill="#ffb7c5"/>
                  <ellipse cx="38" cy="50" rx="6" ry="7" fill="#1a1a1a"/>
                  <ellipse cx="62" cy="50" rx="6" ry="7" fill="#1a1a1a"/>
                  <circle cx="40" cy="48" r="2" fill="#fff"/>
                  <circle cx="64" cy="48" r="2" fill="#fff"/>
                  <ellipse cx="50" cy="60" rx="3" ry="2" fill="#ffb7c5"/>
                  <line x1="14" y1="58" x2="42" y2="62" stroke="#ccc" strokeWidth="1.5"/>
                  <line x1="14" y1="63" x2="42" y2="65" stroke="#ccc" strokeWidth="1.5"/>
                  <line x1="58" y1="62" x2="86" y2="58" stroke="#ccc" strokeWidth="1.5"/>
                  <line x1="58" y1="65" x2="86" y2="63" stroke="#ccc" strokeWidth="1.5"/>
                  <polygon points="58,28 70,22 70,34" fill="#ff6b9d"/>
                  <polygon points="82,28 70,22 70,34" fill="#ff6b9d"/>
                  <circle cx="70" cy="28" r="4" fill="#ff3d7f"/>
                </svg>
              </span>
              <div><h1>MeozzCute 🎀</h1><p>✨ Quản lý dữ liệu</p></div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </header>

        <main>
          {/* CSV Import */}
          <div className="card csv-card">
            <div className="card-title">
              <span className="card-icon">🌸</span>
              <div>
                <h2>Import CSV Shopee Affiliate</h2>
                <p>Import CSV Shopee Affiliate — nhắn cho Meozz (0397088175) hướng dẫn lấy file CSV nếu bạn chưa biết</p>
              </div>
            </div>

            <input ref={csvRef} type="file" accept=".csv" style={{display:'none'}}
              onChange={e => { setCsvFile(e.target.files[0]); setCsvResult(null); setCsvUploadMsg(''); setCsvError('') }} />

            <div className="file-row">
              <button className="btn-choose" onClick={() => csvRef.current.click()}>📁 Chọn file CSV</button>
              {csvFile
                ? <span className="file-name">✅ {csvFile.name}</span>
                : <span className="file-hint">Chưa chọn file</span>}
            </div>

            {csvResult && (
              <div className="preview-row">
                <div className="preview-box">
                  <span>📦 Đơn hàng</span>
                  <strong>{donhangCount} sub_id</strong>
                </div>
                <div className="preview-box">
                  <span>💰 Ví tiền</span>
                  <strong>{vitienCount} sub_id</strong>
                </div>
              </div>
            )}

            {csvError   && <div className="msg err">❌ {csvError}</div>}
            {csvUploadMsg && <div className="msg ok">{csvUploadMsg}</div>}

            <div className="btn-row">
              <button className="btn-process" onClick={handleCsvProcess} disabled={!csvFile || csvProcessing}>
                {csvProcessing ? '⏳ Đang xử lý...' : '⚙️ Tạo 2 file JSON'}
              </button>
              <button className="btn-update" onClick={handleCsvSendBot} disabled={!csvResult || csvUploading}>
                {csvUploading ? '⏳ Đang upload...' : '🚀 Update Now'}
              </button>
            </div>
          </div>

          {/* Reload bot */}
          <div className="card reload-card">
            <div className="card-title">
              <span className="card-icon">🐾</span>
              <div>
                <h2>Tải dữ liệu lên Bot ngay</h2>
                <p>Bot đọc dữ liệu mới từ Redis vào bộ nhớ — khách tra cứu sẽ nhận kết quả mới nhất</p>
              </div>
            </div>
            <button className={`btn-reload${reloadLoading?' loading':''}`} onClick={handleReload} disabled={reloadLoading}>
              {reloadLoading ? '⏳ Đang gửi...' : '🐾 Tải dữ liệu lên Bot ngay'}
            </button>
            {reloadMsg && <div className={`msg ${reloadMsg.startsWith('✅')?'ok':'err'}`}>{reloadMsg}</div>}
          </div>

          {/* Guide */}
          <div className="guide">
            <h3>🎀 Quy trình mỗi ngày</h3>
            <div className="steps">
              <div className="step"><span className="num">1</span><span>🐱 Chọn file CSV Shopee → bấm <b>Tạo 2 file JSON</b></span></div>
              <div className="step"><span className="num">2</span><span>🌸 Kiểm tra số liệu → bấm <b>Update Now</b> để upload</span></div>
              <div className="step"><span className="num">3</span><span>✨ Bấm <b>Tải dữ liệu lên Bot ngay</b> — <b>HOÀN THÀNH</b> 🎉</span></div>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:linear-gradient(135deg,#fff0f6,#fce4ec,#f8f0ff);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;color:#1e293b}
        .wrap{min-height:100vh;padding-bottom:48px}

        header{background:linear-gradient(135deg,#fff0f6,#ffe4f0);border-bottom:1px solid #ffb7c5;padding:0 20px;position:sticky;top:0;z-index:10;box-shadow:0 2px 8px rgba(255,105,180,0.12)}
        .inner{max-width:680px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:60px}
        .hd-left{display:flex;align-items:center;gap:10px}
        .logo{font-size:26px;display:flex;align-items:center}
        h1{font-size:17px;font-weight:700;color:#d63384}
        header p{font-size:12px;color:#f48fb1}
        .logout-btn{background:#fff0f6;border:1px solid #ffb7c5;border-radius:8px;padding:7px 14px;color:#d63384;font-size:13px;cursor:pointer}
        .logout-btn:hover{background:#ffe4f0}

        main{max-width:680px;margin:0 auto;padding:24px 16px;display:flex;flex-direction:column;gap:16px}

        /* Status bar */
        .status-bar{background:#fff;border-radius:16px;padding:16px 20px;display:flex;align-items:center;gap:0;box-shadow:0 1px 4px rgba(0,0,0,0.06);border:1px solid #e2e8f0}
        .status-item{flex:1;display:flex;flex-direction:column;gap:3px}
        .si-label{font-size:13px;color:#64748b}
        .si-val{font-size:16px;font-weight:700;color:#0ea5e9}
        .si-date{font-size:11px;color:#94a3b8}
        .status-divider{width:1px;height:40px;background:#e2e8f0;margin:0 16px}

        /* Cards */
        .card{background:#fff;border-radius:20px;padding:22px;box-shadow:0 2px 12px rgba(255,105,180,0.1);border:1px solid #ffe4f0}
        .card-title{display:flex;align-items:flex-start;gap:12px;margin-bottom:18px}
        .card-icon{font-size:26px;flex-shrink:0}
        .card-title h2{font-size:15px;font-weight:700;color:#d63384;margin-bottom:3px}
        .card-title p{font-size:13px;color:#64748b;line-height:1.5}

        /* CSV card accent */
        .csv-card{border-top:3px solid #ff6b9d}
        .reload-card{border-top:3px solid #f472b6}

        /* File row */
        .file-row{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
        .btn-choose{background:#fff0f6;border:1.5px dashed #ffb7c5;border-radius:10px;padding:10px 18px;color:#d63384;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap}
        .btn-choose:hover{background:#ffe4f0;border-color:#ff6b9d}
        .file-name{font-size:13px;color:#059669;font-weight:500}
        .file-hint{font-size:13px;color:#94a3b8}

        /* Preview */
        .preview-row{display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap}
        .preview-box{flex:1;min-width:120px;background:#fff0f6;border:1px solid #ffb7c5;border-radius:12px;padding:12px 16px;display:flex;flex-direction:column;gap:4px}
        .preview-box span{font-size:12px;color:#64748b}
        .preview-box strong{font-size:20px;font-weight:700;color:#d63384}

        /* Buttons */
        .btn-row{display:flex;gap:10px;flex-wrap:wrap}
        .btn-process{flex:1;min-width:130px;padding:12px;background:#fff0f6;border:1.5px solid #ffb7c5;border-radius:12px;color:#d63384;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
        .btn-process:not(:disabled):hover{background:#ffe4f0}
        .btn-process:disabled{opacity:.4;cursor:not-allowed}
        .btn-update{flex:1;min-width:130px;padding:12px;background:linear-gradient(135deg,#ff6b9d,#d63384);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .2s;box-shadow:0 2px 8px rgba(214,51,132,.3)}
        .btn-update:not(:disabled):hover{opacity:.88}
        .btn-update:disabled{opacity:.35;cursor:not-allowed}
        .btn-reload{width:100%;padding:13px;background:linear-gradient(135deg,#f472b6,#ec4899);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .2s;box-shadow:0 2px 8px rgba(244,114,182,.3)}
        .btn-reload:not(:disabled):hover{opacity:.88}
        .btn-reload:disabled{opacity:.5;cursor:not-allowed}
        .btn-reload.loading{animation:pulse 1.2s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}

        /* Messages */
        .msg{margin-top:12px;border-radius:10px;padding:10px 14px;font-size:13px}
        .msg.ok{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
        .msg.err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}

        /* Guide */
        .guide{background:#fff;border-radius:20px;padding:22px;box-shadow:0 2px 12px rgba(255,105,180,0.1);border:1px solid #ffe4f0}
        .guide h3{font-size:14px;font-weight:600;color:#d63384;margin-bottom:16px}
        .steps{display:flex;flex-direction:column;gap:12px}
        .step{display:flex;align-items:flex-start;gap:12px;font-size:14px;color:#475569;line-height:1.5}
        .num{background:#ffe4f0;color:#d63384;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px}
        code{background:#fff0f6;padding:2px 6px;border-radius:5px;font-size:12px;font-family:monospace;color:#d63384}
        b{color:#d63384}
      `}</style>
    </>
  )
}

// ── XỬ LÝ CSV PHÍA CLIENT — không giới hạn kích thước file ──
function parseCSVLine(line) {
  const result = []; let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQuote = !inQuote }
    else if (c === ',' && !inQuote) { result.push(cur); cur = '' }
    else { cur += c }
  }
  result.push(cur); return result
}

function processCsvClient(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim())
  const headers = parseCSVLine(lines[0].replace(/^\uFEFF/, ''))
  const col = name => headers.indexOf(name)
  const IDX = {
    id: col('ID đơn hàng'), trangThai: col('Trạng thái đặt hàng'),
    thoiGianDat: col('Thời Gian Đặt Hàng'), thoiGianHT: col('Thời gian hoàn thành'),
    tenItem: col('Tên Item'), hoaHongRong: col('Hoa hồng ròng tiếp thị liên kết(₫)'),
    tongHoaDon: col('Tổng hoa hồng đơn hàng(₫)'), subId1: col('Sub_id1'),
  }
  const donMap = {}
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 10) continue
    const subId = cols[IDX.subId1]?.trim(); if (!subId) continue
    const idDon = cols[IDX.id]?.trim(); if (!idDon) continue
    const trangThai  = cols[IDX.trangThai]?.trim()
    const ngayDat    = cols[IDX.thoiGianDat]?.trim() || ''
    const ngayHT     = cols[IDX.thoiGianHT]?.trim() || ''
    const tenItem    = cols[IDX.tenItem]?.trim() || ''
    const hoaHong    = parseFloat(cols[IDX.hoaHongRong]) || 0
    const tongHoaDon = parseFloat(cols[IDX.tongHoaDon]) || 0
    if (!donMap[idDon]) donMap[idDon] = {
      sub_id: subId, id_don_hang: idDon, trang_thai: trangThai,
      ngay_dat_hang: ngayDat, ngay_hoan_thanh: (ngayHT && ngayHT !== '--') ? ngayHT : '--',
      hoa_hong_rong: 0, ten_san_pham: '', ten_san_pham_rut_gon: '',
      tong_pct_hoa_hong: '100.00%', da_co: false,
    }
    if (tongHoaDon > 0 && !donMap[idDon].da_co) {
      donMap[idDon].hoa_hong_rong = hoaHong; donMap[idDon].da_co = true
      if (tenItem) { donMap[idDon].ten_san_pham = tenItem; donMap[idDon].ten_san_pham_rut_gon = tenItem.length > 20 ? tenItem.substring(0,20)+'...' : tenItem }
    }
    if (!donMap[idDon].ten_san_pham && tenItem) {
      donMap[idDon].ten_san_pham = tenItem; donMap[idDon].ten_san_pham_rut_gon = tenItem.length > 20 ? tenItem.substring(0,20)+'...' : tenItem
    }
  }
  const r = n => Math.round(n * 100) / 100
  const donhang = {}, vitien = {}
  for (const don of Object.values(donMap)) {
    const sid = don.sub_id
    if (!donhang[sid]) donhang[sid] = { sub_id: sid, tong_so_don: 0, tong_hoa_hong: 0, don_hang: [] }
    if (!vitien[sid])  vitien[sid]  = { sub_id: sid, dang_cho: 0, don_hoan_thanh: [] }
    const item = { id_don_hang: don.id_don_hang, ten_san_pham: don.ten_san_pham, ten_san_pham_rut_gon: don.ten_san_pham_rut_gon, trang_thai: don.trang_thai, tong_pct_hoa_hong: don.tong_pct_hoa_hong, hoa_hong_rong: r(don.hoa_hong_rong), ngay_dat_hang: don.ngay_dat_hang, ngay_hoan_thanh: don.ngay_hoan_thanh }
    donhang[sid].don_hang.push(item)
    if (don.trang_thai === 'Hoàn thành') { donhang[sid].tong_so_don++; donhang[sid].tong_hoa_hong = r(donhang[sid].tong_hoa_hong + don.hoa_hong_rong) }
    if (don.trang_thai === 'Đang chờ xử lý' && don.hoa_hong_rong > 0) vitien[sid].dang_cho = r(vitien[sid].dang_cho + don.hoa_hong_rong)
    if (don.trang_thai === 'Hoàn thành' && don.hoa_hong_rong > 0) vitien[sid].don_hoan_thanh.push(item)
  }
  return { donhang, vitien }
}
