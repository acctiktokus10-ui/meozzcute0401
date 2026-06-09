import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

export default function Home() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [status, setStatus] = useState({ donhang: null, vitien: null })
  const [loading, setLoading] = useState({ donhang: false, vitien: false })
  const [msg, setMsg] = useState({ donhang: '', vitien: '' })
  const [error, setError] = useState({ donhang: '', vitien: '' })
  const [reloadLoading, setReloadLoading] = useState(false)
  const [reloadMsg, setReloadMsg] = useState('')

  // CSV states
  const [csvFile, setCsvFile] = useState(null)
  const [csvProcessing, setCsvProcessing] = useState(false)
  const [csvResult, setCsvResult] = useState(null)
  const [csvError, setCsvError] = useState('')
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvUploadMsg, setCsvUploadMsg] = useState('')
  const csvRef = useRef()

  useEffect(() => {
    const p = localStorage.getItem('zalo_pwd')
    if (p) { setPassword(p); setAuthed(true) }
  }, [])

  useEffect(() => {
    if (authed) fetchStatus()
  }, [authed])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/status')
      const d = await res.json()
      setStatus(d)
    } catch {}
  }

  function handleLogin(e) {
    e.preventDefault()
    setAuthed(true)
    localStorage.setItem('zalo_pwd', password)
  }

  function handleLogout() {
    setAuthed(false)
    localStorage.removeItem('zalo_pwd')
    setPassword('')
  }

  async function handleUpload(type, file) {
    if (!file) return
    setLoading(l => ({ ...l, [type]: true }))
    setMsg(m => ({ ...m, [type]: '' }))
    setError(e => ({ ...e, [type]: '' }))
    try {
      const text = await file.text()
      let data
      try { data = JSON.parse(text) }
      catch { setError(e => ({ ...e, [type]: '❌ File không phải JSON hợp lệ' })); setLoading(l => ({ ...l, [type]: false })); return }
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, type, data }),
      })
      const result = await res.json()
      if (res.ok) { setMsg(m => ({ ...m, [type]: `✅ ${result.message}` })); fetchStatus() }
      else { setError(e => ({ ...e, [type]: `❌ ${result.error}` })); if (res.status === 401) setAuthed(false) }
    } catch (err) {
      setError(e => ({ ...e, [type]: `❌ Lỗi kết nối: ${err.message}` }))
    }
    setLoading(l => ({ ...l, [type]: false }))
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
      setReloadMsg('⏳ Bot đang tải dữ liệu mới... vui lòng chờ')
      const MAX_WAIT = 60, INTERVAL = 2
      for (let i = 0; i < MAX_WAIT / INTERVAL; i++) {
        await new Promise(r => setTimeout(r, INTERVAL * 1000))
        try {
          const poll = await fetch('/api/reload?poll_status=1')
          const s = await poll.json()
          if (s.state === 'success') {
            setReloadMsg(`✅ Bot đã tải xong! ${s.donhang_count ?? 0} đơn hàng, ${s.vitien_count ?? 0} ví tiền — dữ liệu mới có hiệu lực ngay!`)
            fetchStatus(); setReloadLoading(false); return
          }
          if (s.state === 'error') { setReloadMsg(`❌ Bot báo lỗi: ${s.message}`); setReloadLoading(false); return }
          if (s.state === 'loading') {
            const a = s.attempt ? ` (lần ${s.attempt}/${s.max_attempts})` : ''
            setReloadMsg(`⏳ Bot đang tải dữ liệu từ Vercel...${a}`)
          } else if (s.state === 'retrying') { setReloadMsg(`🔄 ${s.message}`) }
        } catch (_) {}
      }
      setReloadMsg('⚠️ Chờ quá 60 giây — bot có thể đang bận. Kiểm tra log bot nhé!')
    } catch (err) { setReloadMsg(`❌ Lỗi kết nối: ${err.message}`) }
    setReloadLoading(false)
  }

  // CSV handlers
  async function handleCsvProcess() {
    if (!csvFile) return
    setCsvProcessing(true)
    setCsvError('')
    setCsvResult(null)
    setCsvUploadMsg('')
    try {
      const text = await csvFile.text()
      const res = await fetch('/api/process-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi xử lý CSV')
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
      setCsvUploadMsg('✅ Đã cập nhật lên Bot thành công!')
      fetchStatus()
    } catch (e) { setCsvError(e.message) }
    setCsvUploading(false)
  }

  function fmtDate(iso) {
    if (!iso) return 'Chưa có dữ liệu'
    return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  }

  const donhangCount = csvResult ? Object.keys(csvResult.donhang).length : 0
  const vitienCount = csvResult ? Object.keys(csvResult.vitien).length : 0

  if (!authed) {
    return (
      <>
        <Head><title>Zalo Bot — Cập nhật dữ liệu</title></Head>
        <div className="login-wrap">
          <div className="login-card">
            <div className="logo">🤖</div>
            <h1>Zalo Bot</h1>
            <p className="sub">Nhập mật khẩu để tiếp tục</p>
            <form onSubmit={handleLogin}>
              <input type="password" placeholder="Mật khẩu" value={password}
                onChange={e => setPassword(e.target.value)} autoFocus required />
              <button type="submit">Đăng nhập</button>
            </form>
          </div>
        </div>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0f0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }
          .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%); }
          .login-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 40px 32px; width: 100%; max-width: 380px; text-align: center; backdrop-filter: blur(10px); }
          .logo { font-size: 48px; margin-bottom: 12px; }
          h1 { color: #fff; font-size: 24px; font-weight: 700; margin-bottom: 6px; }
          .sub { color: rgba(255,255,255,0.45); font-size: 14px; margin-bottom: 28px; }
          input { width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: #fff; font-size: 16px; margin-bottom: 14px; outline: none; }
          input:focus { border-color: #5e72e4; }
          button { width: 100%; padding: 14px; background: linear-gradient(135deg, #5e72e4, #825ee4); border: none; border-radius: 12px; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
        `}</style>
      </>
    )
  }

  return (
    <>
      <Head><title>Zalo Bot — Cập nhật dữ liệu</title></Head>
      <div className="wrap">
        <header>
          <div className="header-inner">
            <div className="header-left">
              <div className="logo">🤖</div>
              <div><h1>Zalo Bot</h1><p>Quản lý dữ liệu</p></div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </header>

        <main>
          {/* Reload bot */}
          <div className="reload-card">
            <div className="reload-top">
              <div className="reload-info">
                <div className="reload-icon">🔄</div>
                <div>
                  <h2>Tải dữ liệu vào bot</h2>
                  <p>Bot sẽ đọc toàn bộ đơn hàng & ví tiền, lưu vào bộ nhớ. Khách tra cứu sẽ dùng dữ liệu này.</p>
                </div>
              </div>
              <button className={`reload-btn${reloadLoading ? ' loading' : ''}`} onClick={handleReload} disabled={reloadLoading}>
                {reloadLoading ? '⏳ Đang gửi...' : '📥 Tải dữ liệu'}
              </button>
            </div>
            {reloadMsg && <div className={`reload-msg ${reloadMsg.startsWith('✅') ? 'success' : 'err'}`}>{reloadMsg}</div>}
          </div>

          {/* CSV Import section */}
          <div className="divider"><span>Import từ Shopee Affiliate</span></div>

          <div className="csv-card">
            <div className="csv-header">
              <span className="csv-icon">📊</span>
              <div>
                <h2>Import CSV Shopee</h2>
                <p>Chuyển file báo cáo Shopee Affiliate → tự động tạo dữ liệu đơn hàng & ví tiền</p>
              </div>
            </div>

            {/* Chọn file */}
            <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { setCsvFile(e.target.files[0]); setCsvResult(null); setCsvUploadMsg(''); setCsvError('') }} />

            <div className="csv-row">
              <button className="csv-choose-btn" onClick={() => csvRef.current.click()}>
                📁 Chọn file CSV
              </button>
              {csvFile && <span className="csv-filename">✅ {csvFile.name}</span>}
            </div>

            {/* Kết quả preview */}
            {csvResult && (
              <div className="csv-preview">
                <div className="csv-preview-item">
                  <span>📦 Đơn hàng</span>
                  <strong>{donhangCount} sub_id</strong>
                </div>
                <div className="csv-preview-item">
                  <span>💰 Ví tiền</span>
                  <strong>{vitienCount} sub_id</strong>
                </div>
              </div>
            )}

            {csvError && <div className="csv-err">❌ {csvError}</div>}
            {csvUploadMsg && <div className="csv-success">{csvUploadMsg}</div>}

            {/* 2 nút */}
            <div className="csv-btns">
              <button className="csv-btn-process" onClick={handleCsvProcess}
                disabled={!csvFile || csvProcessing}>
                {csvProcessing ? '⏳ Đang xử lý...' : '⚙️ Tạo 2 file JSON'}
              </button>
              <button className="csv-btn-send" onClick={handleCsvSendBot}
                disabled={!csvResult || csvUploading}>
                {csvUploading ? '⏳ Đang gửi...' : '🚀 Cập nhật lên Bot'}
              </button>
            </div>
          </div>

          <div className="divider"><span>Upload file thủ công</span></div>

          <div className="cards">
            <UploadCard icon="🛒" title="Đơn hàng" filename="donhang_by_subid.json" type="donhang"
              loading={loading.donhang} msg={msg.donhang} error={error.donhang}
              statusInfo={status.donhang} fmtDate={fmtDate} onUpload={handleUpload} />
            <UploadCard icon="💰" title="Ví tiền" filename="vitien_by_subid.json" type="vitien"
              loading={loading.vitien} msg={msg.vitien} error={error.vitien}
              statusInfo={status.vitien} fmtDate={fmtDate} onUpload={handleUpload} />
          </div>

          <div className="guide">
            <h2>📋 Quy trình mỗi ngày</h2>
            <div className="steps">
              <div className="step"><span className="num">1</span><span>Chọn file CSV Shopee Affiliate → bấm <strong>Tạo 2 file JSON</strong></span></div>
              <div className="step"><span className="num">2</span><span>Kiểm tra số liệu → bấm <strong>Cập nhật lên Bot</strong></span></div>
              <div className="step"><span className="num">3</span><span>Bấm <strong>Tải dữ liệu</strong> — bot đọc và lưu vào bộ nhớ ngay</span></div>
              <div className="step"><span className="num">4</span><span>Khách nhắn <code>#donhang</code> hoặc <code>#vitien</code> — bot trả dữ liệu mới nhất</span></div>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; color: #fff; }
        .wrap { min-height: 100vh; padding-bottom: 40px; }
        header { background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 20px; position: sticky; top: 0; z-index: 10; backdrop-filter: blur(10px); }
        .header-inner { max-width: 700px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 64px; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .logo { font-size: 28px; }
        h1 { font-size: 18px; font-weight: 700; line-height: 1.2; }
        header p { font-size: 12px; color: rgba(255,255,255,0.4); }
        .logout-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 8px 14px; color: rgba(255,255,255,0.7); font-size: 13px; cursor: pointer; }
        .logout-btn:hover { background: rgba(255,255,255,0.12); }
        main { max-width: 700px; margin: 0 auto; padding: 24px 20px; }

        /* Reload */
        .reload-card { background: linear-gradient(135deg, rgba(94,114,228,0.15), rgba(130,94,228,0.15)); border: 1px solid rgba(94,114,228,0.4); border-radius: 18px; padding: 20px; margin-bottom: 8px; }
        .reload-top { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .reload-info { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
        .reload-icon { font-size: 32px; flex-shrink: 0; }
        .reload-info h2 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .reload-info p { font-size: 13px; color: rgba(255,255,255,0.55); line-height: 1.5; }
        .reload-btn { background: linear-gradient(135deg, #5e72e4, #825ee4); border: none; border-radius: 12px; padding: 13px 20px; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: opacity 0.2s; flex-shrink: 0; }
        .reload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .reload-btn:not(:disabled):hover { opacity: 0.9; }
        .reload-btn.loading { animation: pulse 1.2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:0.7} 50%{opacity:1} }
        .reload-msg { margin-top: 14px; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
        .reload-msg.success { background: rgba(0,200,83,0.15); color: #69f0ae; border: 1px solid rgba(0,200,83,0.3); }
        .reload-msg.err { background: rgba(255,80,80,0.15); color: #ff8a80; border: 1px solid rgba(255,80,80,0.3); }

        /* Divider */
        .divider { display: flex; align-items: center; gap: 12px; margin: 24px 0 16px; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
        .divider span { font-size: 12px; color: rgba(255,255,255,0.35); white-space: nowrap; }

        /* CSV Card */
        .csv-card { background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,182,212,0.1)); border: 1px solid rgba(16,185,129,0.35); border-radius: 18px; padding: 20px; }
        .csv-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
        .csv-icon { font-size: 28px; flex-shrink: 0; }
        .csv-header h2 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .csv-header p { font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.5; }
        .csv-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .csv-choose-btn { background: rgba(255,255,255,0.08); border: 1px dashed rgba(255,255,255,0.25); border-radius: 10px; padding: 11px 18px; color: rgba(255,255,255,0.75); font-size: 14px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .csv-choose-btn:hover { background: rgba(255,255,255,0.13); border-color: rgba(255,255,255,0.45); }
        .csv-filename { font-size: 13px; color: #6ee7b7; }
        .csv-preview { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .csv-preview-item { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 10px 16px; display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: rgba(255,255,255,0.6); flex: 1; min-width: 120px; }
        .csv-preview-item strong { font-size: 18px; font-weight: 700; color: #6ee7b7; }
        .csv-btns { display: flex; gap: 10px; flex-wrap: wrap; }
        .csv-btn-process { flex: 1; min-width: 140px; padding: 13px; background: rgba(6,182,212,0.2); border: 1px solid rgba(6,182,212,0.5); border-radius: 12px; color: #67e8f9; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .csv-btn-process:not(:disabled):hover { background: rgba(6,182,212,0.35); }
        .csv-btn-process:disabled { opacity: 0.4; cursor: not-allowed; }
        .csv-btn-send { flex: 1; min-width: 140px; padding: 13px; background: linear-gradient(135deg, #10b981, #06b6d4); border: none; border-radius: 12px; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
        .csv-btn-send:not(:disabled):hover { opacity: 0.88; }
        .csv-btn-send:disabled { opacity: 0.35; cursor: not-allowed; }
        .csv-err { background: rgba(255,80,80,0.15); color: #ff8a80; border: 1px solid rgba(255,80,80,0.3); border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 12px; }
        .csv-success { background: rgba(0,200,83,0.15); color: #69f0ae; border: 1px solid rgba(0,200,83,0.3); border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 12px; }

        .cards { display: flex; flex-direction: column; gap: 16px; }
        .guide { margin-top: 28px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; }
        .guide h2 { font-size: 15px; font-weight: 600; margin-bottom: 16px; color: rgba(255,255,255,0.7); }
        .steps { display: flex; flex-direction: column; gap: 12px; }
        .step { display: flex; align-items: flex-start; gap: 12px; font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.5; }
        .num { background: rgba(94,114,228,0.3); color: #8fa4f8; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        code { background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: monospace; color: #a8d8ea; }
        strong { color: rgba(255,255,255,0.8); }
      `}</style>
    </>
  )
}

function UploadCard({ icon, title, filename, type, loading, msg, error, statusInfo, fmtDate, onUpload }) {
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(f) { if (f && f.name.endsWith('.json')) setFile(f) }

  async function handleSubmit() {
    if (!file) return
    await onUpload(type, file)
    setFile(null)
  }

  return (
    <div className={`card ${dragOver ? 'drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}>
      <div className="card-header">
        <span className="icon">{icon}</span>
        <div><h2>{title}</h2><code className="fname">{filename}</code></div>
        {statusInfo?.updated_at && <div className="badge">✅ Đã có</div>}
      </div>
      {statusInfo && (
        <div className="status-row">
          <span>🕐 Cập nhật lần cuối:</span>
          <strong>{fmtDate(statusInfo.updated_at)}</strong>
          {statusInfo.count > 0 && <span className="count">{statusInfo.count} sub_id</span>}
        </div>
      )}
      <div className="upload-area">
        <label className="file-label">
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          <span>📂 Chọn file JSON</span>
        </label>
        {file && <div className="file-selected"><span>📄 {file.name}</span><span className="size">({(file.size/1024).toFixed(1)} KB)</span></div>}
        <button className="upload-btn" onClick={handleSubmit} disabled={!file || loading}>
          {loading ? '⏳ Đang upload...' : '⬆️ Upload'}
        </button>
      </div>
      {msg && <div className="msg success">{msg}</div>}
      {error && <div className="msg err">{error}</div>}
      <style>{`
        .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; padding: 20px; transition: border-color 0.2s; }
        .card.drag { border-color: #5e72e4; background: rgba(94,114,228,0.1); }
        .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .card-header .icon { font-size: 28px; }
        .card-header h2 { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
        .card-header .fname { background: rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 5px; font-size: 11px; font-family: monospace; color: #a8d8ea; }
        .badge { margin-left: auto; background: rgba(0,200,83,0.2); color: #00c853; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .status-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .status-row strong { color: rgba(255,255,255,0.8); }
        .count { background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 10px; font-size: 11px; }
        .upload-area { display: flex; flex-direction: column; gap: 10px; }
        .file-label { display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border: 1px dashed rgba(255,255,255,0.2); border-radius: 12px; padding: 14px; cursor: pointer; font-size: 14px; color: rgba(255,255,255,0.7); text-align: center; transition: all 0.2s; }
        .file-label:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.4); }
        .file-selected { background: rgba(94,114,228,0.15); border: 1px solid rgba(94,114,228,0.3); border-radius: 8px; padding: 10px 14px; font-size: 13px; display: flex; align-items: center; gap: 6px; color: #a8b8ff; }
        .size { color: rgba(255,255,255,0.4); font-size: 11px; }
        .upload-btn { background: linear-gradient(135deg, #5e72e4, #825ee4); border: none; border-radius: 12px; padding: 14px; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; transition: opacity 0.2s; }
        .upload-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .upload-btn:not(:disabled):hover { opacity: 0.9; }
        .msg { border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-top: 4px; }
        .success { background: rgba(0,200,83,0.15); color: #69f0ae; border: 1px solid rgba(0,200,83,0.3); }
        .err { background: rgba(255,80,80,0.15); color: #ff8a80; border: 1px solid rgba(255,80,80,0.3); }
      `}</style>
    </div>
  )
}
