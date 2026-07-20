/* global SillyTavern, toastr, jQuery */
(() => {
  'use strict';

  const MODULE_NAME = 'mobileforme';
  const DEFAULT_SETTINGS = {
    apiBaseUrl: 'http://localhost:8787',
    injectContext: true,
    activeAccount: 'personal',
    customCss: '',
  };

  const APP_DEFS = [
    ['messages', '💬', '即時消息'],
    ['wallet', '💸', '電子錢包'],
    ['bank', '🏦', '昭明銀行'],
    ['delivery', '🍱', '外賣'],
    ['mall', '🛒', '網購商城'],
    ['social', '📸', '社群網絡'],
    ['inspect', '🔎', '查 TA 手機'],
    ['settings', '⚙️', '設定'],
  ];

  const fallbackState = {
    character: '目前角色',
    messages: [
      { from: '林遙', account: 'personal', text: '今晚還去老地方嗎？', time: '20:13' },
      { from: '主管', account: 'work', text: '明早 9 點同步專案進度。', time: '18:40' },
    ],
    moments: [
      { author: '林遙', text: '下雨天適合熱奶茶。', time: '今天' },
    ],
    wallet: { balance: 2380.5, assets: ['電影券 x2', '咖啡會員點數 1240'], transactions: [
      { title: '轉帳給 林遙', amount: -120, time: '昨天' },
      { title: '便利店', amount: -36, time: '今天' },
    ] },
    bank: { name: '昭明銀行', balance: 128450.33, accounts: ['活期存款', '薪資戶'], records: [
      { title: '薪資入帳', amount: 32000, time: '本月 5 日' },
    ] },
    delivery: [{ shop: '青禾便當', items: ['雞腿飯', '冬瓜茶'], status: '已送達', time: '週二 12:23' }],
    mall: [{ title: '藍牙耳機', logistics: '配送中：抵達分揀中心', time: '昨天' }],
    social: {
      instagram: [{ author: '目前角色', text: '加班後的城市夜景。', time: '2 小時前' }],
      forum: [{ board: '匿名情感', text: '如果對方已讀不回三天，還要主動嗎？', time: '今天' }],
    },
  };

  const ctx = () => (typeof SillyTavern !== 'undefined' ? SillyTavern.getContext?.() : window.SillyTavern?.getContext?.()) || {};
  const extensionSettings = () => {
    const context = ctx();
    context.extensionSettings ||= {};
    context.extensionSettings[MODULE_NAME] ||= { ...DEFAULT_SETTINGS };
    return context.extensionSettings[MODULE_NAME];
  };

  let state = structuredCloneSafe(fallbackState);
  let currentApp = 'messages';

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getCharacterName() {
    const context = ctx();
    return context.characters?.[context.characterId]?.name || context.name2 || fallbackState.character;
  }

  function getWorldInfoSummary() {
    const context = ctx();
    const entries = Object.values(context.worldInfo?.entries || context.world_info?.entries || {}).slice(0, 8);
    return entries.map((entry) => entry.comment || entry.key?.join?.(', ') || entry.keys?.join?.(', ')).filter(Boolean).join('；');
  }

  async function apiFetch(path, options = {}) {
    const settings = extensionSettings();
    const url = `${settings.apiBaseUrl.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  async function refreshState() {
    try {
      const character = encodeURIComponent(getCharacterName());
      state = await apiFetch(`/state?character=${character}`);
      toast('MobileForMe 已同步獨立 API', 'success');
    } catch (error) {
      state.character = getCharacterName();
      toast(`API 不可用，使用本機示例資料：${error.message}`, 'warning');
    }
    render();
  }

  function toast(message, type = 'info') {
    if (typeof toastr !== 'undefined') toastr[type]?.(message);
    else console.log(`[${MODULE_NAME}] ${message}`);
  }

  function contextSummary() {
    return [
      `角色手機摘要：${state.character || getCharacterName()}`,
      `帳號：${extensionSettings().activeAccount === 'work' ? '上班專用帳號' : '私人帳號'}`,
      `未讀/近期消息：${(state.messages || []).slice(0, 3).map((m) => `${m.from}:${m.text}`).join('；')}`,
      `錢包餘額：${state.wallet?.balance ?? '未知'}；昭明銀行資產：${state.bank?.balance ?? '未知'}`,
      `近期外賣：${(state.delivery || [])[0]?.shop || '無'}；近期網購：${(state.mall || [])[0]?.title || '無'}`,
      `世界書辨識：${getWorldInfoSummary() || '未讀取到世界書摘要'}`,
    ].join('\n');
  }

  function installContextInjection() {
    const context = ctx();
    if (!context.setExtensionPrompt) return;
    const updatePrompt = () => {
      context.setExtensionPrompt(MODULE_NAME, extensionSettings().injectContext ? contextSummary() : '', 2, 1);
    };
    setInterval(updatePrompt, 5000);
    updatePrompt();
  }

  function renderAppContent() {
    const settings = extensionSettings();
    const account = settings.activeAccount;
    if (currentApp === 'messages') {
      const messages = (state.messages || []).filter((m) => !m.account || m.account === account);
      return `<div class="mfm-row"><b>${account === 'work' ? '上班專用帳號' : '私人帳號'}</b><button id="mfm_toggle_account">切換帳號</button></div>${feed(messages.map((m) => `<b>${escapeHtml(m.from)}</b><span class="mfm-muted">${escapeHtml(m.time)}</span><br>${escapeHtml(m.text)}`))}<h4>朋友動態</h4>${feed((state.moments || []).map((m) => `<b>${escapeHtml(m.author)}</b>：${escapeHtml(m.text)}<br><span class="mfm-muted">${escapeHtml(m.time)}</span>`))}`;
    }
    if (currentApp === 'wallet') return moneyView('電子錢包', state.wallet, true);
    if (currentApp === 'bank') return moneyView('昭明銀行', state.bank, false);
    if (currentApp === 'delivery') return feed((state.delivery || []).map((o) => `<b>${escapeHtml(o.shop)}</b> ${escapeHtml(o.status)}<br>${escapeHtml((o.items || []).join('、'))}<br><span class="mfm-muted">${escapeHtml(o.time)}</span>`));
    if (currentApp === 'mall') return feed((state.mall || []).map((o) => `<b>${escapeHtml(o.title)}</b><br>${escapeHtml(o.logistics)}<br><span class="mfm-muted">${escapeHtml(o.time)}</span>`));
    if (currentApp === 'social') return `<h4>Instagram</h4>${feed((state.social?.instagram || []).map(postView))}<h4>匿名論壇</h4>${feed((state.social?.forum || []).map((p) => `<b>${escapeHtml(p.board)}</b><br>${escapeHtml(p.text)}<br><span class="mfm-muted">${escapeHtml(p.time)}</span>`))}`;
    if (currentApp === 'inspect') return `<div class="mfm-card"><h3>查 TA 手機：${escapeHtml(state.character || getCharacterName())}</h3><pre>${escapeHtml(contextSummary())}</pre><button id="mfm_open_inspect">另開新畫面</button></div>`;
    return settingsView(settings);
  }

  function moneyView(title, data = {}, canTransfer) {
    return `<div class="mfm-card"><h3>${title}</h3><div class="mfm-accent">餘額：${Number(data.balance || 0).toLocaleString()}</div><p>${escapeHtml((data.assets || data.accounts || []).join('、'))}</p>${canTransfer ? '<input id="mfm_transfer_to" placeholder="收款人"><input id="mfm_transfer_amount" type="number" placeholder="金額"><button id="mfm_transfer">轉帳</button>' : ''}</div>${feed((data.transactions || data.records || []).map((r) => `${escapeHtml(r.title)} <b>${Number(r.amount || 0).toLocaleString()}</b><br><span class="mfm-muted">${escapeHtml(r.time)}</span>`))}`;
  }

  function settingsView(settings) {
    return `<div class="mfm-setting"><label>API Base URL<input id="mfm_api" value="${escapeHtml(settings.apiBaseUrl)}"></label><label><input id="mfm_inject" type="checkbox" ${settings.injectContext ? 'checked' : ''}> 注入正文上下文</label><label>個性化 CSS<textarea id="mfm_css" rows="6">${escapeHtml(settings.customCss)}</textarea></label><button id="mfm_save">保存設定</button></div>`;
  }

  const feed = (items) => `<div class="mfm-feed">${items.map((x) => `<div class="mfm-card">${x}</div>`).join('') || '<div class="mfm-muted">暫無紀錄</div>'}</div>`;
  const postView = (p) => `<b>${escapeHtml(p.author)}</b><br>${escapeHtml(p.text)}<br><span class="mfm-muted">${escapeHtml(p.time)}</span>`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

  function render() {
    let root = document.getElementById('mobileforme_panel');
    if (!root) {
      root = document.createElement('div');
      root.id = 'mobileforme_panel';
      document.querySelector('#extensions_settings')?.append(root) || document.body.append(root);
    }
    root.innerHTML = `<div class="mfm-phone"><div class="mfm-statusbar"><span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>📶 🔋</span></div><div class="mfm-toolbar"><b>MobileForMe</b><button id="mfm_refresh">同步</button></div><div class="mfm-app-grid">${APP_DEFS.map(([id, icon, label]) => `<button class="mfm-app-button" data-app="${id}"><span class="mfm-app-icon">${icon}</span>${label}</button>`).join('')}</div><div class="mfm-content">${renderAppContent()}</div></div><style id="mfm_custom_css">${extensionSettings().customCss}</style>`;
    bindEvents(root);
  }

  function bindEvents(root) {
    root.querySelectorAll('[data-app]').forEach((button) => button.addEventListener('click', () => { currentApp = button.dataset.app; render(); }));
    root.querySelector('#mfm_refresh')?.addEventListener('click', refreshState);
    root.querySelector('#mfm_toggle_account')?.addEventListener('click', () => { const s = extensionSettings(); s.activeAccount = s.activeAccount === 'work' ? 'personal' : 'work'; render(); });
    root.querySelector('#mfm_save')?.addEventListener('click', () => { const s = extensionSettings(); s.apiBaseUrl = root.querySelector('#mfm_api').value; s.injectContext = root.querySelector('#mfm_inject').checked; s.customCss = root.querySelector('#mfm_css').value; render(); });
    root.querySelector('#mfm_open_inspect')?.addEventListener('click', () => { const w = window.open('', 'mobileforme-inspect', 'width=520,height=760'); w.document.write(`<pre>${escapeHtml(contextSummary())}</pre>`); });
    root.querySelector('#mfm_transfer')?.addEventListener('click', async () => {
      const payload = { character: getCharacterName(), to: root.querySelector('#mfm_transfer_to').value, amount: Number(root.querySelector('#mfm_transfer_amount').value) };
      try { await apiFetch('/transfer', { method: 'POST', body: JSON.stringify(payload) }); await refreshState(); }
      catch (error) { toast(`轉帳需要可用 API：${error.message}`, 'error'); }
    });
  }

  jQuery?.(document).ready?.(() => { extensionSettings(); render(); refreshState(); installContextInjection(); });
  if (document.readyState !== 'loading') { extensionSettings(); render(); refreshState(); installContextInjection(); }
})();
