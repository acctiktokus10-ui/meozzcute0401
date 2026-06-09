// pages/csv-import.js
import { useState, useRef } from 'react';

export default function CsvImport() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null); // { donhang, vitien }
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileRef = useRef();

  async function handleLogin(e) {
    e.preventDefault();
    const res = await fetch('/api/status');
    const envPass = process.env.NEXT_PUBLIC_UPLOAD_PASSWORD;
    // Kiểm tra qua API upload
    const check = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, type: 'ping', data: {} }),
    });
    if (check.ok || check.status === 400) {
      setAuthed(true);
    } else {
      setAuthError('Mật khẩu không đúng');
    }
  }

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');
    setUploadDone(false);
  }

  async function handleProcess() {
    if (!file) return;
    setProcessing(true);
    setError('');
    setResult(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/process-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi xử lý CSV');
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSendToBot() {
    if (!result) return;
    setUploading(true);
    setError('');
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, type: 'donhang', data: result.donhang }),
        }),
        fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, type: 'vitien', data: result.vitien }),
        }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error('Upload thất bại');
      setUploadDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  const donhangKeys = result ? Object.keys(result.donhang) : [];
  const vitienKeys = result ? Object.keys(result.vitien) : [];

  if (!authed) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>🤖</div>
          <h2 style={styles.title}>Zalo Bot</h2>
          <p style={styles.sub}>Import CSV Shopee Affiliate</p>
          <form onSubmit={handleLogin}>
            <input
              style={styles.input}
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {authError && <p style={styles.err}>{authError}</p>}
            <button style={styles.btn} type="submit">Đăng nhập</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 700, width: '95%' }}>
        <div style={styles.logo}>📊</div>
        <h2 style={styles.title}>Import CSV Shopee</h2>
        <p style={styles.sub}>Upload file báo cáo → xem trước → gửi lên Bot</p>

        {/* Bước 1: Chọn file */}
        <div style={styles.step}>
          <div style={styles.stepLabel}>① Chọn file CSV</div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button style={styles.btnOutline} onClick={() => fileRef.current.click()}>
            📁 Chọn file CSV
          </button>
          {file && <span style={styles.fileName}>✅ {file.name}</span>}
        </div>

        {/* Bước 2: Xử lý */}
        {file && !result && (
          <div style={styles.step}>
            <div style={styles.stepLabel}>② Xử lý dữ liệu</div>
            <button style={styles.btn} onClick={handleProcess} disabled={processing}>
              {processing ? '⏳ Đang xử lý...' : '🔄 Xử lý CSV'}
            </button>
          </div>
        )}

        {error && <div style={styles.errorBox}>❌ {error}</div>}

        {/* Preview kết quả */}
        {result && (
          <>
            <div style={styles.step}>
              <div style={styles.stepLabel}>③ Xem trước dữ liệu</div>
              <div style={styles.tabs}>
                <PreviewSection
                  title={`📦 Đơn hàng — ${donhangKeys.length} sub_id`}
                  data={result.donhang}
                  type="donhang"
                />
                <PreviewSection
                  title={`💰 Ví tiền — ${vitienKeys.length} sub_id`}
                  data={result.vitien}
                  type="vitien"
                />
              </div>
            </div>

            {/* Bước 4: Gửi lên bot */}
            <div style={styles.step}>
              <div style={styles.stepLabel}>④ Gửi lên Bot</div>
              {uploadDone ? (
                <div style={styles.successBox}>🎉 Đã gửi lên Bot thành công!</div>
              ) : (
                <button
                  style={{ ...styles.btn, background: '#22c55e' }}
                  onClick={handleSendToBot}
                  disabled={uploading}
                >
                  {uploading ? '⏳ Đang gửi...' : '🚀 Gửi lên Bot'}
                </button>
              )}
            </div>

            {/* Nút làm lại */}
            <button
              style={styles.btnOutline}
              onClick={() => { setResult(null); setFile(null); setUploadDone(false); }}
            >
              🔁 Import file khác
            </button>
          </>
        )}

        <div style={{ marginTop: 24 }}>
          <a href="/" style={styles.link}>← Về trang upload thủ công</a>
        </div>
      </div>
    </div>
  );
}

function PreviewSection({ title, data, type }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(data).slice(0, 5);

  return (
    <div style={styles.previewBox}>
      <div style={styles.previewHeader} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={styles.previewBody}>
          {keys.map(k => {
            const item = data[k];
            if (type === 'vitien') {
              return (
                <div key={k} style={styles.previewItem}>
                  <b>sub_id:</b> {item.sub_id}<br />
                  <b>Đang chờ:</b> {item.dang_cho?.toLocaleString('vi-VN')}₫<br />
                  <b>Hoàn thành:</b> {item.don_hoan_thanh?.length} đơn
                </div>
              );
            } else {
              return (
                <div key={k} style={styles.previewItem}>
                  <b>sub_id:</b> {item.sub_id}<br />
                  <b>Số đơn:</b> {item.don_list?.length} đơn<br />
                  {item.don_list?.slice(0, 2).map(d => (
                    <div key={d.id_don_hang} style={{ marginLeft: 12, fontSize: 12, color: '#888' }}>
                      #{d.id_don_hang} — {d.trang_thai}
                    </div>
                  ))}
                </div>
              );
            }
          })}
          {Object.keys(data).length > 5 && (
            <div style={{ color: '#888', fontSize: 12, padding: '4px 12px' }}>
              ... và {Object.keys(data).length - 5} sub_id khác
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f0f1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  },
  card: {
    background: '#1a1a2e',
    borderRadius: 16,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    color: '#fff',
    textAlign: 'center',
  },
  logo: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 700, margin: '0 0 4px' },
  sub: { color: '#888', fontSize: 14, marginBottom: 24 },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid #333',
    background: '#0f0f1a',
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%',
    padding: '13px',
    borderRadius: 8,
    border: 'none',
    background: '#6366f1',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 8,
  },
  btnOutline: {
    width: '100%',
    padding: '11px',
    borderRadius: 8,
    border: '1px solid #444',
    background: 'transparent',
    color: '#ccc',
    fontSize: 14,
    cursor: 'pointer',
    marginBottom: 8,
  },
  err: { color: '#f87171', fontSize: 13, marginBottom: 8 },
  step: { textAlign: 'left', marginBottom: 20 },
  stepLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#a5b4fc',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fileName: { display: 'block', color: '#86efac', fontSize: 13, marginTop: 6 },
  errorBox: {
    background: '#3f1515',
    color: '#fca5a5',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'left',
  },
  successBox: {
    background: '#14532d',
    color: '#86efac',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 14,
    fontWeight: 600,
  },
  previewBox: {
    border: '1px solid #333',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  previewHeader: {
    padding: '10px 14px',
    background: '#16213e',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    fontWeight: 600,
    color: '#c7d2fe',
  },
  previewBody: {
    background: '#0f0f1a',
    maxHeight: 260,
    overflowY: 'auto',
  },
  previewItem: {
    padding: '10px 14px',
    borderBottom: '1px solid #1e1e2e',
    fontSize: 13,
    color: '#d1d5db',
    lineHeight: 1.7,
  },
  link: { color: '#6366f1', fontSize: 13, textDecoration: 'none' },
  tabs: {},
};
