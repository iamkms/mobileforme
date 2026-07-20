/* global SillyTavern, toastr, jQuery */
(() => {
  'use strict';

  const MODULE_NAME = 'mobileforme';
  const DEFAULT_SETTINGS = {
    apiBaseUrl: 'http://localhost:8787',
    apiKey: '',
    modelName: '',
    availableModels: [],
    injectContext: true,
    activeAccount: 'personal',
    customCss: '',
    launcherX: 24,
    launcherY: 120,
    phoneWidth: 430,
    phoneHeight: 720,
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

  const stateByScope = new Map();
  let state = structuredCloneSafe(fallbackState);
  let currentApp = 'messages';
  let phoneOpen = false;

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getScopeKey() {
    const context = ctx();
    const chatId = context.chatId || context.chat?.id || context.chat?.name || context.chatMetadata?.main_chat || 'global-chat';
    const characterId = context.characterId ?? context.name2 ?? 'global-character';
    return `${chatId}:${characterId}`;
  }

  function activateScopedState() {
    const scope = getScopeKey();
    if (!stateByScope.has(scope)) stateByScope.set(scope, structuredCloneSafe(fallbackState));
    state = stateByScope.get(scope);
    state.character = getCharacterName();
    state.scope = scope;
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
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  async function refreshState() {
    try {
      const character = encodeURIComponent(getCharacterName());
      const remoteState = await apiFetch(`/state?character=${character}&scope=${encodeURIComponent(getScopeKey())}&model=${encodeURIComponent(extensionSettings().modelName || '')}`);
      state = { ...structuredCloneSafe(fallbackState), ...remoteState, character: getCharacterName(), scope: getScopeKey() };
      stateByScope.set(getScopeKey(), state);
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
      activateScopedState();
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
      return `<div class="mfm-row"><b>${account === 'work' ? '上班專用帳號' : '私人帳號'}</b><button id="mfm_toggle_account">切換帳號</button></div>${feed(messages.map((m) => `<b>${escapeHtml(m.from)}</b><span class="mfm-muted">${escapeHtml(m.time)}</span><br>${escapeHtml(m.group ? `群聊「${m.group}」：` : '')}${escapeHtml(m.text)}`))}<div class="mfm-card"><h4>發送訊息</h4><select id="mfm_message_mode"><option value="direct">私聊角色</option><option value="group">群聊</option></select><input id="mfm_message_group" placeholder="群聊名稱，例如：工作群 / 好友群"><textarea id="mfm_message_text" rows="3" placeholder="輸入 user 要發給角色或群聊的訊息"></textarea><button id="mfm_send_message">發送</button></div><h4>朋友動態</h4>${feed((state.moments || []).map((m) => `<b>${escapeHtml(m.author)}</b>：${escapeHtml(m.text)}<br><span class="mfm-muted">${escapeHtml(m.time)}</span>`))}`;
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
    return `<div class="mfm-card"><h3>${title}</h3><div class="mfm-accent">餘額：${Number(data.balance || 0).toLocaleString()}</div><p>${escapeHtml((data.assets || data.accounts || []).join('、'))}</p>${canTransfer ? '<input id="mfm_transfer_to" placeholder="收款人"><input id="mfm_transfer_amount" type="number" placeholder="金額"><button id="mfm_transfer">轉帳</button><hr><input id="mfm_receive_from" placeholder="付款人"><input id="mfm_receive_amount" type="number" placeholder="收款金額"><button id="mfm_receive">收錢</button>' : ''}</div>${feed((data.transactions || data.records || []).map((r) => `${escapeHtml(r.title)} <b>${Number(r.amount || 0).toLocaleString()}</b><br><span class="mfm-muted">${escapeHtml(r.time)}</span>`))}`;
  }

  function settingsView(settings) {
    return `<div class="mfm-setting"><label>API Base URL<input id="mfm_api" value="${escapeHtml(settings.apiBaseUrl)}"></label><label>API 密鑰<input id="mfm_api_key" type="password" value="${escapeHtml(settings.apiKey)}" placeholder="Bearer token / 服務密鑰"></label><label>LLM 模型<select id="mfm_model"><option value="">未選擇</option>${(settings.availableModels || []).map((model) => `<option value="${escapeHtml(model)}" ${settings.modelName === model ? 'selected' : ''}>${escapeHtml(model)}</option>`).join('')}</select></label><div class="mfm-row"><button id="mfm_load_models">拉取模型列表</button><input id="mfm_pull_model_name" placeholder="模型名稱，例如 gpt-4.1-mini"><button id="mfm_pull_model">拉取模型</button></div><label><input id="mfm_inject" type="checkbox" ${settings.injectContext ? 'checked' : ''}> 注入正文上下文</label><label>手機寬度/高度<input id="mfm_phone_width" type="number" value="${Number(settings.phoneWidth) || 430}"><input id="mfm_phone_height" type="number" value="${Number(settings.phoneHeight) || 720}"></label><label>個性化 CSS<textarea id="mfm_css" rows="6">${escapeHtml(settings.customCss)}</textarea></label><button id="mfm_save">保存設定</button></div>`;
  }

  const feed = (items) => `<div class="mfm-feed">${items.map((x) => `<div class="mfm-card">${x}</div>`).join('') || '<div class="mfm-muted">暫無紀錄</div>'}</div>`;
  const postView = (p) => `<b>${escapeHtml(p.author)}</b><br>${escapeHtml(p.text)}<br><span class="mfm-muted">${escapeHtml(p.time)}</span>`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

  function render() {
    let root = document.getElementById('mobileforme_panel');
    if (!root) {
      root = document.createElement('div');
      root.id = 'mobileforme_panel';
      document.body.append(root);
    }
    activateScopedState();
    const settings = extensionSettings();
    const phoneStyle = `width:${Number(settings.phoneWidth) || 430}px;min-height:${Number(settings.phoneHeight) || 720}px`;
    root.innerHTML = `<button id="mfm_launcher" aria-label="打開 MobileForMe 手機" style="left:${Number(settings.launcherX) || 24}px;top:${Number(settings.launcherY) || 120}px"><span>📱</span></button><div id="mfm_overlay" class="${phoneOpen ? 'mfm-open' : ''}" aria-hidden="${phoneOpen ? 'false' : 'true'}"><div class="mfm-backdrop" data-close="true"></div><div class="mfm-phone" style="${phoneStyle}" role="dialog" aria-modal="true" aria-label="MobileForMe 手機"><div class="mfm-statusbar"><span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>📶 🔋</span></div><div class="mfm-toolbar"><b>MobileForMe</b><span><button id="mfm_refresh">同步</button><button id="mfm_close" aria-label="關閉手機">關閉</button></span></div><div class="mfm-app-grid">${APP_DEFS.map(([id, icon, label]) => `<button class="mfm-app-button" data-app="${id}"><span class="mfm-app-icon">${icon}</span>${label}</button>`).join('')}</div><div class="mfm-content">${renderAppContent()}</div></div></div><style id="mfm_custom_css">${extensionSettings().customCss}</style>`;
    bindEvents(root);
  }

  function bindEvents(root) {
    bindLauncher(root.querySelector('#mfm_launcher'));
    root.querySelectorAll('[data-app]').forEach((button) => button.addEventListener('click', () => { currentApp = button.dataset.app; render(); }));
    root.querySelector('#mfm_refresh')?.addEventListener('click', refreshState);
    root.querySelector('#mfm_close')?.addEventListener('click', () => { phoneOpen = false; render(); });
    root.querySelector('[data-close]')?.addEventListener('click', () => { phoneOpen = false; render(); });
    root.querySelector('#mfm_toggle_account')?.addEventListener('click', () => { const s = extensionSettings(); s.activeAccount = s.activeAccount === 'work' ? 'personal' : 'work'; render(); });
    root.querySelector('#mfm_save')?.addEventListener('click', () => { const s = extensionSettings(); s.apiBaseUrl = root.querySelector('#mfm_api').value; s.apiKey = root.querySelector('#mfm_api_key')?.value || ''; s.modelName = root.querySelector('#mfm_model')?.value || s.modelName; s.injectContext = root.querySelector('#mfm_inject').checked; s.phoneWidth = Number(root.querySelector('#mfm_phone_width')?.value) || 430; s.phoneHeight = Number(root.querySelector('#mfm_phone_height')?.value) || 720; s.customCss = root.querySelector('#mfm_css').value; render(); });
    root.querySelector('#mfm_open_inspect')?.addEventListener('click', () => { const w = window.open('', 'mobileforme-inspect', 'width=520,height=760'); w.document.write(`<pre>${escapeHtml(contextSummary())}</pre>`); });
    root.querySelector('#mfm_load_models')?.addEventListener('click', loadModels);
    root.querySelector('#mfm_pull_model')?.addEventListener('click', pullModel);
    root.querySelector('#mfm_send_message')?.addEventListener('click', sendMessage);
    root.querySelector('#mfm_transfer')?.addEventListener('click', async () => {
      const payload = { character: getCharacterName(), scope: getScopeKey(), to: root.querySelector('#mfm_transfer_to').value, amount: Number(root.querySelector('#mfm_transfer_amount').value), direction: 'out' };
      try { await apiFetch('/transfer', { method: 'POST', body: JSON.stringify(payload) }); await refreshState(); }
      catch (error) { recordWalletTransfer(payload.to, -payload.amount); toast(`API 不可用，已記錄本機轉帳：${error.message}`, 'warning'); render(); }
    });
    root.querySelector('#mfm_receive')?.addEventListener('click', async () => {
      const payload = { character: getCharacterName(), scope: getScopeKey(), from: root.querySelector('#mfm_receive_from').value, amount: Number(root.querySelector('#mfm_receive_amount').value), direction: 'in' };
      try { await apiFetch('/transfer', { method: 'POST', body: JSON.stringify(payload) }); await refreshState(); }
      catch (error) { recordWalletTransfer(payload.from, payload.amount); toast(`API 不可用，已記錄本機收款：${error.message}`, 'warning'); render(); }
    });
  }

  async function loadModels() {
    try {
      const result = await apiFetch('/models');
      const models = result.models || result.data?.map?.((item) => item.id || item.name) || [];
      const settings = extensionSettings();
      settings.availableModels = models.filter(Boolean);
      if (!settings.modelName && settings.availableModels[0]) settings.modelName = settings.availableModels[0];
      toast('已拉取可用 LLM 模型', 'success');
      render();
    } catch (error) {
      toast(`拉取模型列表失敗：${error.message}`, 'error');
    }
  }

  async function pullModel() {
    const input = document.getElementById('mfm_pull_model_name');
    const model = input?.value?.trim();
    if (!model) return toast('請輸入要拉取的模型名稱', 'warning');
    try {
      await apiFetch('/models/pull', { method: 'POST', body: JSON.stringify({ model }) });
      const settings = extensionSettings();
      settings.availableModels = Array.from(new Set([...(settings.availableModels || []), model]));
      settings.modelName = model;
      toast(`已拉取並選擇模型：${model}`, 'success');
      render();
    } catch (error) {
      toast(`拉取模型失敗：${error.message}`, 'error');
    }
  }

  async function sendMessage() {
    const mode = document.getElementById('mfm_message_mode')?.value || 'direct';
    const group = document.getElementById('mfm_message_group')?.value?.trim();
    const text = document.getElementById('mfm_message_text')?.value?.trim();
    if (!text) return toast('請輸入要發送的訊息', 'warning');
    const message = { from: 'user', to: getCharacterName(), account: extensionSettings().activeAccount, group: mode === 'group' ? (group || '群聊') : '', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    try {
      await apiFetch('/event', { method: 'POST', body: JSON.stringify({ type: 'message', scope: getScopeKey(), character: getCharacterName(), message }) });
      await refreshState();
    } catch (error) {
      state.messages ||= [];
      state.messages.unshift(message);
      stateByScope.set(getScopeKey(), state);
      toast(`API 不可用，訊息已保留在此聊天窗口：${error.message}`, 'warning');
      render();
    }
  }

  function recordWalletTransfer(peer, amount) {
    state.wallet ||= { balance: 0, transactions: [] };
    state.wallet.balance = Number(state.wallet.balance || 0) + Number(amount || 0);
    state.wallet.transactions ||= [];
    state.wallet.transactions.unshift({ title: `${amount >= 0 ? '收款自' : '轉帳給'} ${peer || '未知對象'}`, amount, time: new Date().toLocaleString() });
    stateByScope.set(getScopeKey(), state);
  }

  function bindLauncher(button) {
    if (!button) return;
    let dragged = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    button.addEventListener('pointerdown', (event) => {
      dragged = false;
      startX = event.clientX;
      startY = event.clientY;
      originX = button.offsetLeft;
      originY = button.offsetTop;
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener('pointermove', (event) => {
      if (event.buttons !== 1) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) dragged = true;
      const nextX = Math.min(Math.max(8, originX + dx), window.innerWidth - button.offsetWidth - 8);
      const nextY = Math.min(Math.max(8, originY + dy), window.innerHeight - button.offsetHeight - 8);
      button.style.left = `${nextX}px`;
      button.style.top = `${nextY}px`;
    });
    button.addEventListener('pointerup', () => {
      const settings = extensionSettings();
      settings.launcherX = button.offsetLeft;
      settings.launcherY = button.offsetTop;
      if (!dragged) phoneOpen = true;
      render();
    });
  }

  jQuery?.(document).ready?.(() => { extensionSettings(); render(); refreshState(); installContextInjection(); });
  if (document.readyState !== 'loading') { extensionSettings(); render(); refreshState(); installContextInjection(); }
})();
