// 京都支店仕分けアプリ（client-side, static hosting OK）
let DATA = [];
let READY = false;
let SELECTED_WARD = ""; // 例: '中京区'
const WARD_ORDER = ["下京区", "中京区", "上京区", "左京区", "右京区", "西京区", "東山区", "山科区"];

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

function modeLabel(mode) {
  if (mode === "postal") return "郵便番号";
  if (mode === "code") return "仕分けコード";
  return "住所";
}

function setSelectedWard(ward) {
  SELECTED_WARD = ward || "";
  const label = $("wardSelected");
  if (label) label.textContent = SELECTED_WARD || "未選択";

  // buttons active state
  document.querySelectorAll("[data-ward]").forEach((b) => {
    const w = b.getAttribute("data-ward") || "";
    const active = (w === SELECTED_WARD);
    b.style.background = active ? "#111827" : "#fff";
    b.style.color = active ? "#fff" : "#111";
    b.style.borderColor = active ? "#111827" : "#e5e7eb";
  });
}

function buildWardButtons() {
  const bar = $("wardBar");
  if (!bar) return;

  // Extract wards from data (order preferred)
  const set = new Set();
  DATA.forEach((r) => { if (r.ward) set.add(r.ward); });
  let wards = Array.from(set);

  // sort by WARD_ORDER then remaining
  const idx = new Map(WARD_ORDER.map((w,i)=>[w,i]));
  wards.sort((a,b)=> (idx.has(a)?idx.get(a):999) - (idx.has(b)?idx.get(b):999) || a.localeCompare(b, "ja"));

  bar.innerHTML = wards.map((w) => `
    <button type="button" data-ward="${escapeHtml(w)}" style="padding:10px 12px; border-radius:999px; border:1px solid #e5e7eb; background:#fff; color:#111; font-weight:700; cursor:pointer;">${escapeHtml(w)}</button>
  `).join("") + `
    <button type="button" id="wardClear" style="padding:10px 12px; border-radius:999px; border:1px solid #e5e7eb; background:#fff; color:#111; font-weight:700; cursor:pointer;">未選択に戻す</button>
  `;

  bar.querySelectorAll("[data-ward]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelectedWard(btn.getAttribute("data-ward") || "");
      // 郵便番号モードの場合は即検索しやすいようにフォーカス
      $("q").focus();
      if ($("q").value.trim() && getMode() === "postal") runSearch();
    });
  });
  $("wardClear").addEventListener("click", () => {
    setSelectedWard("");
    $("q").focus();
    if ($("q").value.trim() && getMode() === "postal") runSearch();
  });

  setSelectedWard("");
}

function render(rows, q, mode) {
  const el = $("results");
  if (!q) {
    el.innerHTML = "";
    return;
  }
  const total = rows.length;

  const wardInfo = (mode === "postal" && normDigits(q).length === 4)
    ? ` / 区：<b>${escapeHtml(SELECTED_WARD || "未選択")}</b>`
    : "";

  const head = `
    <div class="meta">
      <small><span class="pill">${modeLabel(mode)}</span> で <b>${escapeHtml(q)}</b> を検索${wardInfo} → <b>${total}</b> 件</small>
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

function search(q, mode) {
  if (!READY) return [];
  if (!q) return [];

  if (mode === "postal") {
    const d = normDigits(q);
    if (!d) return [];

    // 下4桁検索：区の選択が必須
    if (d.length === 4) {
      if (!SELECTED_WARD) {
        toast("区を先に選んでください（郵便番号下4桁検索）");
        return [];
      }
      return DATA.filter((r) => r.ward === SELECTED_WARD && (r.postal || "").endsWith(d));
    }

    // 7桁（またはそれ以上）は従来通り：完全一致（先頭7桁）
    if (d.length >= 7) return DATA.filter((r) => r.postal === d.slice(0, 7));

    // それ以外（3〜6桁）は前方一致（区選択は任意）
    if (SELECTED_WARD) {
      return DATA.filter((r) => r.ward === SELECTED_WARD && (r.postal || "").startsWith(d));
    }
    return DATA.filter((r) => (r.postal || "").startsWith(d));
  }

  if (mode === "code") {
    const d = normDigits(q);
    if (!d) return [];
    if (d.length >= 4) return DATA.filter((r) => r.code === d.slice(0, 4));
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
    buildWardButtons();
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
