// 京都支店仕分けアプリ（シンプル現場版 / static hosting OK）
let DATA = [];
let READY = false;
let SELECTED_WARD = "";

const WARDS = ["西京区", "下京区", "山科区", "東山区", "右京区", "中京区", "上京区", "左京区"];

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

function buildWardButtons() {
  const box = $("wards");
  box.innerHTML = "";
  WARDS.forEach((w) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = w;
    btn.setAttribute("data-ward", w);
    btn.addEventListener("click", () => {
      setWard(w);
      $("zip").focus();
      // 下4桁が入ってたら即再検索
      const d = normDigits($("zip").value);
      if (d.length === 4 || d.length >= 7) doSearch(true);
    });
    box.appendChild(btn);
  });
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

  // それ以外：今回は現場向けに「4桁 or 7桁」で統一（誤入力防止）
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
    detail.textContent = "該当なし（入力ミスの可能性）\n・下4桁：区を選択 → 4桁\n・7桁：そのまま7桁";
    return;
  }

  // 1件ならそれを表示
  if (matches.length === 1) {
    const r = matches[0];
    codeBox.textContent = r.code || "----";
    detail.style.display = "block";
    detail.textContent = `${r.ward || ""}\n${formatPostal(r.postal)}\n${r.address || ""}`;
    return;
  }

  // 複数件：よくあるケース（同じ下4桁が複数住所） → 仕分けCDが同じなら1つ、違うなら注意を出す
  const codes = Array.from(new Set(matches.map(m => m.code).filter(Boolean)));
  if (codes.length === 1) {
    codeBox.textContent = codes[0];
    detail.style.display = "block";
    detail.textContent =
      `同じ下4桁の候補が ${matches.length} 件ありますが、仕分けCDは共通です。\n` +
      `区：${SELECTED_WARD || "（区指定なし）"} / 入力：${digits}\n` +
      `（必要なら住所を目視で確認）`;
  } else {
    codeBox.textContent = "要確認";
    detail.style.display = "block";
    detail.textContent =
      `同じ下4桁でも仕分けCDが複数あります（${codes.join(", ")}）。\n` +
      `住所の町名まで確認して、住所検索（スペース区切り）版を使うか、\n` +
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
    buildWardButtons();
  } catch (e) {
    console.error(e);
    $("status").textContent = "エラー：データ読み込みに失敗しました（data.json の配置を確認）";
  }
}

function doSearch(silent=false) {
  if (!READY) return;
  const digits = normDigits($("zip").value);

  // 誤入力を減らす（4桁 or 7桁）
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
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupCopy();

  $("searchBtn").addEventListener("click", () => doSearch(false));
  $("resetBtn").addEventListener("click", clearAll);
  $("clearWard").addEventListener("click", () => {
    setWard("");
    $("zip").focus();
    const d = normDigits($("zip").value);
    if (d.length === 4 || d.length >= 7) doSearch(true);
  });

  $("zip").addEventListener("input", () => {
    // 4桁 or 7桁になったら自動検索（現場向け）
    const d = normDigits($("zip").value);
    if (d.length === 4 || d.length >= 7) doSearch(true);
    if (d.length === 0) showResult([], "");
  });

  $("zip").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch(false);
    if (e.key === "Escape") clearAll();
  });

  $("zip").focus();
});
