// pages/index.js
import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function Home() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [status, setStatus] = useState({ donhang: null, vitien: null })
  const [loading, setLoading] = useState({ donhang: false, vitien: false })
  const [msg, setMsg] = useState({ donhang: '', vitien: '' })
  const [error, setError] = useState({ donhang: '', vitien: '' })
  const [savedPwd, setSavedPwd] = useState('')

  useEffect(() => {
    const p = localStorage.getItem('zalo_pwd')
    if (p) { setSavedPwd(p); setPassword(p) }
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
      try {
        data = JSON.parse(text)
      } catch {
        setError(e => ({ ...e, [type]: '❌ File không phải JSON hợp lệ' }))
        setLoading(l => ({ ...l, [type]: false }))
        return
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, type, data }),
      })
      const result = await res.json()

      if (res.ok) {
        setMsg(m => ({ ...m, [type]: `✅ ${result.message}` }))
        fetchStatus()
      } else {
        setError(e => ({ ...e, [type]: `❌ ${result.error}` }))
        if (res.status === 401) setAuthed(false)
      }
    } catch (err) {
      setError(e => ({ ...e, [type]: `❌ Lỗi kết nối: ${err.message}` }))
    }

    setLoading(l => ({ ...l, [type]: false }))
  }

  function fmtDate(iso) {
    if (!iso) return 'Chưa có dữ liệu'
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  }

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
              <input
                type="password"
                placeholder="Mật khẩu"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                required
              />
              <button type="submit">Đăng nhập</button>
            </form>
          </div>
        </div>

        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0f0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }
          .login-wrap {
            min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
          }
          .login-card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 40px 32px;
            width: 100%; max-width: 380px;
            text-align: center;
            backdrop-filter: blur(10px);
          }
          .logo { font-size: 48px; margin-bottom: 12px; }
          h1 { color: #fff; font-size: 24px; font-weight: 700; margin-bottom: 6px; }
          .sub { color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 28px; }
          input {
            width: 100%;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 12px;
            padding: 14px 16px;
            color: #fff;
            font-size: 16px;
            margin-bottom: 14px;
            outline: none;
            transition: border-color 0.2s;
          }
          input:focus { border-color: #5e72e4; }
          button {
            width: 100%;
            background: linear-gradient(135deg, #5e72e4, #825ee4);
            border: none; border-radius: 12px;
            padding: 14px;
            color: #fff; font-size: 16px; font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          button:hover { opacity: 0.9; }
          button:active { opacity: 0.8; }
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
              <span className="logo">🤖</span>
              <div>
                <h1>Zalo Bot</h1>
                <p>Quản lý dữ liệu</p>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </header>

        <main>
          <div className="cards">
            {/* Đơn hàng */}
            <UploadCard
              icon="🛒"
              title="Đơn hàng"
              filename="donhang_by_subid.json"
              type="donhang"
              loading={loading.donhang}
              msg={msg.donhang}
              error={error.donhang}
              statusInfo={status.donhang}
              fmtDate={fmtDate}
              onUpload={handleUpload}
            />

            {/* Ví tiền */}
            <UploadCard
              icon="💰"
              title="Ví tiền"
              filename="vitien_by_subid.json"
              type="vitien"
              loading={loading.vitien}
              msg={msg.vitien}
              error={error.vitien}
              statusInfo={status.vitien}
              fmtDate={fmtDate}
              onUpload={handleUpload}
            />
          </div>

          {/* Hướng dẫn */}
          <div className="guide">
            <h2>📋 Hướng dẫn sử dụng</h2>
            <div className="steps">
              <div className="step">
                <span className="num">1</span>
                <span>Chuẩn bị file <code>donhang_by_subid.json</code> hoặc <code>vitien_by_subid.json</code></span>
              </div>
              <div className="step">
                <span className="num">2</span>
                <span>Bấm nút <strong>Chọn file JSON</strong> tương ứng và chọn file từ điện thoại / máy tính</span>
              </div>
              <div className="step">
                <span className="num">3</span>
                <span>Bấm <strong>Upload</strong> — dữ liệu được lưu ngay lập tức</span>
              </div>
              <div className="step">
                <span className="num">4</span>
                <span>Bot sẽ tự động đọc dữ liệu mới nhất mỗi khi khách nhắn <code>#donhang</code> hoặc <code>#vitien</code></span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #0f0f1a;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          min-height: 100vh;
          color: #fff;
        }
        .wrap { min-height: 100vh; padding-bottom: 40px; }

        header {
          background: rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding: 0 20px;
          position: sticky; top: 0; z-index: 10;
          backdrop-filter: blur(10px);
        }
        .header-inner {
          max-width: 700px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          height: 64px;
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .logo { font-size: 28px; }
        h1 { font-size: 18px; font-weight: 700; line-height: 1.2; }
        header p { font-size: 12px; color: rgba(255,255,255,0.4); }
        .logout-btn {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          padding: 8px 14px;
          color: rgba(255,255,255,0.7);
          font-size: 13px;
          cursor: pointer;
        }
        .logout-btn:hover { background: rgba(255,255,255,0.12); }

        main { max-width: 700px; margin: 0 auto; padding: 24px 20px; }

        .cards { display: flex; flex-direction: column; gap: 16px; }

        /* Guide */
        .guide {
          margin-top: 28px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 24px;
        }
        .guide h2 { font-size: 15px; font-weight: 600; margin-bottom: 16px; color: rgba(255,255,255,0.7); }
        .steps { display: flex; flex-direction: column; gap: 12px; }
        .step {
          display: flex; align-items: flex-start; gap: 12px;
          font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.5;
        }
        .num {
          background: rgba(94,114,228,0.3);
          color: #8fa4f8;
          border-radius: 50%;
          width: 22px; height: 22px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          flex-shrink: 0; margin-top: 1px;
        }
        code {
          background: rgba(255,255,255,0.1);
          padding: 2px 6px; border-radius: 4px;
          font-size: 12px; font-family: monospace;
          color: #a8d8ea;
        }
        strong { color: rgba(255,255,255,0.8); }
      `}</style>
    </>
  )
}

function UploadCard({ icon, title, filename, type, loading, msg, error, statusInfo, fmtDate, onUpload }) {
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(f) {
    if (f && f.name.endsWith('.json')) setFile(f)
  }

  async function handleSubmit() {
    if (!file) return
    await onUpload(type, file)
    setFile(null)
  }

  return (
    <div className={`card ${dragOver ? 'drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
    >
      <div className="card-header">
        <span className="icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          <code className="fname">{filename}</code>
        </div>
        {statusInfo?.updated_at && (
          <div className="badge">✅ Đã có</div>
        )}
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
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
          <span>📂 Chọn file JSON</span>
        </label>

        {file && (
          <div className="file-selected">
            <span>📄 {file.name}</span>
            <span className="size">({(file.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}

        <button
          className="upload-btn"
          onClick={handleSubmit}
          disabled={!file || loading}
        >
          {loading ? '⏳ Đang upload...' : '⬆️ Upload'}
        </button>
      </div>

      {msg && <div className="msg success">{msg}</div>}
      {error && <div className="msg err">{error}</div>}

      <style>{`
        .card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 18px;
          padding: 20px;
          transition: border-color 0.2s;
        }
        .card.drag { border-color: #5e72e4; background: rgba(94,114,228,0.1); }
        .card-header {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 14px;
        }
        .card-header .icon { font-size: 28px; }
        .card-header h2 { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
        .card-header .fname {
          background: rgba(255,255,255,0.08);
          padding: 2px 7px; border-radius: 5px;
          font-size: 11px; font-family: monospace;
          color: #a8d8ea;
        }
        .badge {
          margin-left: auto;
          background: rgba(0,200,83,0.2);
          color: #00c853;
          padding: 4px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600;
          white-space: nowrap;
        }
        .status-row {
          display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
          font-size: 12px; color: rgba(255,255,255,0.5);
          margin-bottom: 16px; padding-bottom: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .status-row strong { color: rgba(255,255,255,0.8); }
        .count {
          background: rgba(255,255,255,0.08);
          padding: 2px 8px; border-radius: 10px;
          font-size: 11px;
        }
        .upload-area { display: flex; flex-direction: column; gap: 10px; }
        .file-label {
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.08);
          border: 1px dashed rgba(255,255,255,0.2);
          border-radius: 12px;
          padding: 14px;
          cursor: pointer;
          font-size: 14px; color: rgba(255,255,255,0.7);
          text-align: center;
          transition: all 0.2s;
        }
        .file-label:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.4); }
        .file-selected {
          background: rgba(94,114,228,0.15);
          border: 1px solid rgba(94,114,228,0.3);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          display: flex; align-items: center; gap: 6px;
          color: #a8b8ff;
        }
        .size { color: rgba(255,255,255,0.4); font-size: 11px; }
        .upload-btn {
          background: linear-gradient(135deg, #5e72e4, #825ee4);
          border: none; border-radius: 12px;
          padding: 14px;
          color: #fff; font-size: 15px; font-weight: 600;
          cursor: pointer; width: 100%;
          transition: opacity 0.2s;
        }
        .upload-btn:disabled {
          opacity: 0.4; cursor: not-allowed;
        }
        .upload-btn:not(:disabled):hover { opacity: 0.9; }
        .msg {
          border-radius: 8px; padding: 10px 14px;
          font-size: 13px; margin-top: 4px;
        }
        .success { background: rgba(0,200,83,0.15); color: #69f0ae; border: 1px solid rgba(0,200,83,0.3); }
        .err { background: rgba(255,80,80,0.15); color: #ff8a80; border: 1px solid rgba(255,80,80,0.3); }
      `}</style>
    </div>
  )
}
