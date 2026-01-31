(function(){
  'use strict';

  const data = window.SORTING_DATA;
  if(!data){ console.error('SORTING_DATA not found'); return; }

  const wardButtonsEl = document.getElementById('wardButtons');
  const selectedWardEl = document.getElementById('selectedWard');
  const zipInput = document.getElementById('zipInput');
  const clearBtn = document.getElementById('clearBtn');

  const resultCodeEl = document.getElementById('resultCode');
  const resultMetaEl = document.getElementById('resultMeta');
  const errorsEl = document.getElementById('errors');

  const candidatesWrap = document.getElementById('candidates');
  const candidateListEl = document.getElementById('candidateList');

  let selectedWard = null;

  function setError(msg){
    errorsEl.textContent = msg || '';
  }
  function setResult(code, metaHtml){
    resultCodeEl.textContent = code || '—';
    resultMetaEl.innerHTML = metaHtml || '';
  }
  function setCandidates(list){
    if(!list || list.length <= 1){
      candidatesWrap.classList.add('hidden');
      candidateListEl.innerHTML = '';
      return;
    }
    candidatesWrap.classList.remove('hidden');
    candidateListEl.innerHTML = '';
    list.forEach(item => {
      const div = document.createElement('button');
      div.type = 'button';
      div.className = 'candidate';
      div.innerHTML = `
        <div class="c-code">仕分けCD：${escapeHtml(item.code)}</div>
        <div class="c-ex">例：${escapeHtml((item.examples||[]).slice(0,5).join(' / '))}</div>
      `;
      div.addEventListener('click', () => {
        setCandidates(null);
        setError('');
        setResult(item.code, `<span class="label">区：</span>${escapeHtml(selectedWard)}　<span class="label">入力：</span>${escapeHtml(getDigits(zipInput.value))}`);
      });
      candidateListEl.appendChild(div);
    });
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  function getDigits(s){
    return String(s||'').replace(/\D/g,'');
  }

  function normalizeInputDigits(digits){
    // allow 4,5,7
    if(digits.length >= 7){
      return {key5: digits.slice(-5), key4: digits.slice(-4), usedLen: 5, shown: digits.slice(-5)};
    }
    if(digits.length === 5){
      return {key5: digits, key4: digits.slice(-4), usedLen: 5, shown: digits};
    }
    if(digits.length === 4){
      return {key5: null, key4: digits, usedLen: 4, shown: digits};
    }
    if(digits.length > 5 && digits.length < 7){
      // 6 digits: use last5
      return {key5: digits.slice(-5), key4: digits.slice(-4), usedLen: 5, shown: digits.slice(-5)};
    }
    return null;
  }

  function lookup(){
    setError('');
    setCandidates(null);

    if(!selectedWard){
      setResult('—', '');
      const d = getDigits(zipInput.value);
      if(d.length >= 1) setError('まず区を選択してください。');
      return;
    }

    const digits = getDigits(zipInput.value);
    if(digits.length === 0){
      setResult('—', '');
      return;
    }

    const norm = normalizeInputDigits(digits);
    if(!norm || (digits.length < 4)){
      setResult('—', '');
      setError('4桁または5桁（または7桁）で入力してください。');
      return;
    }

    // Prefer 5-digit key if available; otherwise 4-digit.
    const map5 = data.suffixMaps && data.suffixMaps['5'] && data.suffixMaps['5'][selectedWard];
    const map4 = data.suffixMaps && data.suffixMaps['4'] && data.suffixMaps['4'][selectedWard];

    let entries = null;
    let used = null;

    if(norm.key5 && map5 && map5[norm.key5]){
      entries = map5[norm.key5];
      used = 5;
    }else if(map4 && map4[norm.key4]){
      entries = map4[norm.key4];
      used = 4;
    }

    if(!entries){
      setResult('—', `<span class="label">区：</span>${escapeHtml(selectedWard)}　<span class="label">入力：</span>${escapeHtml(norm.shown)}`);
      setError('該当なし（データにない郵便番号、または区が違う可能性があります）。');
      return;
    }

    // If multiple candidates, show list; otherwise show the single code.
    if(entries.length > 1){
      setResult('—', `<span class="label">区：</span>${escapeHtml(selectedWard)}　<span class="label">入力：</span>${escapeHtml(norm.shown)}　<span class="label">判定：</span>${used}桁（候補あり）`);
      setCandidates(entries);
      return;
    }

    const code = entries[0].code;
    setResult(code, `<span class="label">区：</span>${escapeHtml(selectedWard)}　<span class="label">入力：</span>${escapeHtml(norm.shown)}　<span class="label">判定：</span>${used}桁`);
  }

  function renderWards(){
    wardButtonsEl.innerHTML = '';
    data.wards.forEach(w => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ward-btn';
      btn.textContent = w.name;
      btn.addEventListener('click', () => {
        selectedWard = w.name;
        // update styles
        [...wardButtonsEl.querySelectorAll('.ward-btn')].forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedWardEl.textContent = selectedWard;
        lookup(); // re-run
        zipInput.focus();
      });
      wardButtonsEl.appendChild(btn);
    });
  }

  // Events
  zipInput.addEventListener('input', () => lookup());
  clearBtn.addEventListener('click', () => {
    zipInput.value = '';
    setError('');
    setCandidates(null);
    setResult('—','');
    zipInput.focus();
  });

  // Init
  renderWards();
  setResult('—','');
})();