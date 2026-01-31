// 京都支店仕分けアプリ（シンプル現場版 / static hosting OK）
let DATA = [];
let READY = false;
let SELECTED_WARD = "";

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => (t.style.display = "none"), 1600);
}

function normDigits(s) {
  return (s || "").toString().normalize("NFKC").replace(/[^0-9]/g, "");
}

function setWard(ward) {
  SELECTED_WARD = ward || "";
  $("wardSelected").textContent = SELECTED_WARD || "未選択";
  document.querySelectorAll("#wards button[data-ward]").forEach((b) => {
    const w = b.getAttribute("data-ward") || "";
    b.classList.toggle("active", w === SELECTED_WARD);
  });
}

function getWardOrder(wards) {
  // 現場で使いやすい並び（必要に応じてここだけ変更）
  const preferred = ["南区","西京区","下京区","山科区","東山区","右京区","中京区","上京区","北区","左京区","伏見区"];
  const set = new Set(wards);
  const ordered = [];
  preferred.forEach((w) => { if (set.has(w)) ordered.push(w); });
  wards.forEach((w) => { if (!ordered.includes(w)) ordered.push(w); });
  return ordered;
}

function buildWardButtonsFromData() {
  const box = $("wards");
  if (!box) return;
  box.innerHTML = "";

  // DATAから区を抽出
  const wards = Array.from(new Set(DATA.map(r => r.ward).filter(Boolean)));
  const ordered = getWardOrder(wards);

  if (ordered.length === 0) {
    box.innerHTML = '<span class="warn">区データが見つかりませんでした（data.json を確認）</span>';
    return;
  }

  // 画像のレイアウトに合わせて「上段5個 + 下段残り」にする
  const top = ordered.slice(0, 5);
  const bottom = ordered.slice(5);

  const row1 = document.createElement("div");
  row1.className = "wardRow";
  const row2 = document.createElement("div");
  row2.className = "wardRow";

  function makeBtn(w){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = w;
    btn.setAttribute("data-ward", w);
    btn.addEventListener("click", () => {
      setWard(w);
      $("zip").focus();
      doSearch(true); // 入力中なら自動で再検索
    });
    return btn;
  }

  top.forEach((w) => row1.appendChild(makeBtn(w)));
  if (bottom.length) bottom.forEach((w) => row2.appendChild(makeBtn(w)));

  box.appendChild(row1);
  if (bottom.length) box.appendChild(row2);

  setWard("");
}

function findMatches(digits) {
  // 7桁以上：先頭7桁完全一致（区は任意）
  if (digits.length >= 7) {
    const z7 = digits.slice(0, 7);
    return DATA.filter((r) => (r.postal || "") === z7);
  }

  // 4桁：末尾一致（区必須）
  if (digits.length === 4) {
    if (!SELECTED_WARD) return null; // 区が無い
    return DATA.filter((r) => r.ward === SELECTED_WARD && (r.postal || "").endsWith(digits));
  }

  // それ以外：誤入力防止（4桁 or 7桁のみ）
  return [];
}

function showResult(matches, digits) {
  const codeBox = $("codeBox");
  const detail = $("detailBox");

  if (!digits) {
    codeBox.textContent = "----";
    detail.style.display = "none";
    detail.textContent = "";
    return;
  }

  if (matches === null) {
    codeBox.textContent = "----";
    detail.style.display = "block";
    detail.innerHTML = '<span class="warn">区を先に選んでください（下4桁検索）</span>';
    return;
  }

  if (!matches.length) {
    codeBox.textContent = "----";
    detail.style.display = "block";
    detail.textContent =
      "該当なし（入力ミスの可能性）
" +
      "・下4桁：区を選択 → 4桁
" +
      "・7桁：そのまま7桁";
    return;
  }

  if (matches.length === 1) {
    const r = matches[0];
    codeBox.textContent = r.code || "----";
    detail.style.display = "block";
    detail.textContent = `${r.ward || ""}
${formatPostal(r.postal)}
${r.address || ""}`;
    return;
  }

  // 複数件：仕分けCDが共通なら表示、複数なら「要確認」
  const codes = Array.from(new Set(matches.map(m => m.code).filter(Boolean)));
  if (codes.length === 1) {
    codeBox.textContent = codes[0];
    detail.style.display = "block";
    detail.textContent =
      `同じ下4桁の候補が ${matches.length} 件ありますが、仕分けCDは共通です。
` +
      `区：${SELECTED_WARD || "（区指定なし）"} / 入力：${digits}
` +
      `（必要なら住所を目視で確認）`;
  } else {
    codeBox.textContent = "要確認";
    detail.style.display = "block";
    detail.textContent =
      `同じ下4桁でも仕分けCDが複数あります（${codes.join(", ")}）。
` +
      `7桁郵便番号で検索してください。`;
  }
}

function formatPostal(p) {
  const d = normDigits(p);
  return d.length === 7 ? d.slice(0,3) + "-" + d.slice(3) : d;
}

async function loadData() {
  $("status").textContent = "データ読み込み中…";
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("data.json 読み込み失敗");
    DATA = await res.json();
    READY = true;
    $("status").textContent = `読み込み完了：${DATA.length.toLocaleString()} 件`;
    buildWardButtonsFromData();
  } catch (e) {
    console.error(e);
    $("status").textContent = "エラー：データ読み込みに失敗しました（data.json の配置を確認）";
  }
}

function doSearch(silent=false) {
  if (!READY) return;
  const digits = normDigits($("zip").value);

  // 4桁 or 7桁以上 以外はガイド表示
  if (!(digits.length === 4 || digits.length >= 7) && digits.length > 0) {
    showResult([], digits);
    if (!silent) toast("4桁（下4桁）か 7桁（郵便番号）で入力してください");
    return;
  }

  const matches = findMatches(digits);
  showResult(matches, digits);
}

function clearAll() {
  $("zip").value = "";
  showResult([], "");
  $("zip").focus();
}

function setupCopy() {
  $("codeBox").addEventListener("click", async () => {
    const v = ($("codeBox").textContent || "").trim();
    if (!v || v === "----" || v === "要確認") return;
    try {
      await navigator.clipboard.writeText(v);
      toast("コピーしました：" + v);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = v;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("コピーしました：" + v);
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupCopy();

  
  $("clearWard").addEventListener("click", () => {
    setWard("");
    $("zip").focus();
    doSearch(true);
  });

  // 入力中に自動検索：4桁 or 7桁以上で即表示
  $("zip").addEventListener("input", () => {
    const d = normDigits($("zip").value);
    if (d.length === 0) showResult([], "");
    else if (d.length === 4 || d.length >= 7) doSearch(true);
    else doSearch(true); // 途中でもガイドを出す（迷い防止）
  });

  $("zip").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch(false);
    if (e.key === "Escape") clearAll();
  });

  $("zip").focus();
});
