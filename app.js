// 京都支店仕分けアプリ（client-side, static hosting OK）
let DATA = [];
let READY = false;

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => (t.style.display = "none"), 1400);
}

function normDigits(s) {
  return (s || "")
    .toString()
    .normalize("NFKC")
    .replace(/[^0-9]/g, "");
}

function normText(s) {
  return (s || "").toString().normalize("NFKC").trim();
}

function getMode() {
  const r = document.querySelector('input[name="mode"]:checked');
  return r ? r.value : "address";
}

function render(rows, q, mode) {
  const el = $("results");
  if (!q) {
    el.innerHTML = "";
    return;
  }
  const total = rows.length;

  const head = `
    <div class="meta">
      <small><span class="pill">${modeLabel(mode)}</span> で <b>${escapeHtml(q)}</b> を検索 → <b>${total}</b> 件</small>
      <small class="muted">最大 50 件表示（多い場合は絞り込み）</small>
    </div>
  `;

  const shown = rows.slice(0, 50);
  const body = shown
    .map((r) => {
      const code = r.code || "";
      const postal = r.postal || "";
      const addr = r.address || "";
      const ward = r.ward ? `<span class="pill">${escapeHtml(r.ward)}</span>` : "";
      return `
        <tr>
          <td>
            <b>${escapeHtml(code)}</b><br/>
            <button class="copyBtn" data-copy="${escapeHtml(code)}" style="margin-top:6px; padding:8px 10px; border-radius:10px; background:#f3f4f6; color:#111; border:1px solid #e5e7eb; font-weight:700;">コピー</button>
          </td>
          <td>${escapeHtml(formatPostal(postal))}</td>
          <td>${ward}<div style="margin-top:6px">${escapeHtml(addr)}</div></td>
        </tr>
      `;
    })
    .join("");

  el.innerHTML = head + `
    <table>
      <thead>
        <tr>
          <th style="width:140px;">仕分けコード</th>
          <th style="width:140px;">郵便番号</th>
          <th>住所</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;

  // copy buttons
  el.querySelectorAll(".copyBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const v = btn.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(v);
        toast("コピーしました：" + v);
      } catch (e) {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = v;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast("コピーしました：" + v);
      }
    });
  });
}

function modeLabel(mode) {
  if (mode === "postal") return "郵便番号";
  if (mode === "code") return "仕分けコード";
  return "住所";
}

function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[c]);
}

function formatPostal(p) {
  const d = normDigits(p);
  if (d.length === 7) return d.slice(0, 3) + "-" + d.slice(3);
  return d;
}

function search(q, mode) {
  if (!READY) return [];
  if (!q) return [];
  if (mode === "postal") {
    const d = normDigits(q);
    if (!d) return [];
    // 7桁なら完全一致、短いなら前方一致
    if (d.length >= 7) return DATA.filter((r) => r.postal === d.slice(0,7));
    return DATA.filter((r) => (r.postal || "").startsWith(d));
  }
  if (mode === "code") {
    const d = normDigits(q);
    if (!d) return [];
    // 4桁なら完全一致、短いなら前方一致
    if (d.length >= 4) return DATA.filter((r) => r.code === d.slice(0,4));
    return DATA.filter((r) => (r.code || "").startsWith(d));
  }
  // address (AND search by tokens split by spaces)
  const t = normText(q);
  if (!t) return [];
  const tokens = t.split(/\s+/).filter(Boolean);
  return DATA.filter((r) => {
    const a = normText(r.address);
    return tokens.every((tk) => a.includes(tk));
  });
}

async function loadData() {
  $("status").textContent = "データ読み込み中…";
  $("btnSearch").disabled = true;
  document.body.classList.add("loading");
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("data.json が読み込めませんでした");
    DATA = await res.json();
    READY = true;
    $("status").textContent = `読み込み完了：${DATA.length.toLocaleString()} 件`;
  } catch (e) {
    console.error(e);
    $("status").textContent = "エラー：データ読み込みに失敗しました（data.json の場所を確認）";
  } finally {
    $("btnSearch").disabled = false;
    document.body.classList.remove("loading");
  }
}

function runSearch() {
  const q = $("q").value;
  const mode = getMode();
  const rows = search(q, mode);
  render(rows, q, mode);
}

function clearAll() {
  $("q").value = "";
  $("results").innerHTML = "";
  $("q").focus();
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadData();

  $("btnSearch").addEventListener("click", runSearch);
  $("btnClear").addEventListener("click", clearAll);

  $("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
    if (e.key === "Escape") clearAll();
  });

  document.querySelectorAll('input[name="mode"]').forEach((r) => {
    r.addEventListener("change", () => {
      // 入力があるときは切り替え後に即検索
      if ($("q").value.trim()) runSearch();
    });
  });

  $("q").focus();
});
