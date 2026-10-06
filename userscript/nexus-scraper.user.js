// ==UserScript==
// @name         Nexus Scanlation Manhwa Downloader
// @namespace    https://nexusscanlation.com/
// @version      1.1.0
// @description  Téléchargeur intelligent de chapitres Manhwa en archive ZIP pour NexusScanlation (filtrage automatique des pubs/crédits, sélection de pages, boutons intégrés).
// @author       NexusScraper
// @match        https://nexusscanlation.com/*
// @match        https://*.nexusscanlation.com/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const API_BASE = 'https://api.nexusscanlation.com/api/v1';

  // --- STYLES INJECTÉS ---
  const CSS_STYLES = `
    :root {
      --nx-gold: #e2b339;
      --nx-gold-hover: #f3c759;
      --nx-gold-glow: rgba(226, 179, 57, 0.35);
      --nx-bg-dark: rgba(10, 18, 36, 0.94);
      --nx-bg-card: rgba(15, 27, 54, 0.96);
      --nx-border: rgba(226, 179, 57, 0.3);
      --nx-text-primary: #ffffff;
      --nx-text-muted: #94a3b8;
      --nx-radius: 12px;
      --nx-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(226, 179, 57, 0.15);
      --nx-font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #nx-floating-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--nx-bg-dark);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--nx-border);
      border-radius: 50px;
      padding: 8px 14px;
      box-shadow: var(--nx-shadow);
      font-family: var(--nx-font);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    #nx-floating-panel:hover {
      border-color: rgba(226, 179, 57, 0.8);
      box-shadow: 0 12px 35px -5px rgba(0, 0, 0, 0.8), 0 0 20px var(--nx-gold-glow);
      transform: translateY(-2px);
    }

    .nx-brand-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--nx-gold);
      font-weight: 700;
      font-size: 13px;
      padding-right: 8px;
      border-right: 1px solid rgba(255, 255, 255, 0.15);
    }

    .nx-btn-download {
      display: flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, var(--nx-gold) 0%, #ca9b2b 100%);
      color: #0b1329;
      border: none;
      padding: 9px 18px;
      border-radius: 30px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(226, 179, 57, 0.35);
      transition: all 0.2s ease;
    }

    .nx-btn-download:hover {
      background: linear-gradient(135deg, var(--nx-gold-hover) 0%, var(--nx-gold) 100%);
      transform: scale(1.03);
    }

    .nx-format-select {
      background: rgba(255, 255, 255, 0.08);
      color: var(--nx-text-primary);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
    }

    .nx-format-select option {
      background: #0f1b36;
      color: #fff;
    }

    /* Bouton propre inséré dans chaque carte de chapitre */
    .nx-chapter-inline-btn {
      margin-left: auto;
      margin-right: 6px;
      flex-shrink: 0;
      z-index: 10;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(226, 179, 57, 0.14);
      border: 1px solid rgba(226, 179, 57, 0.45);
      color: var(--nx-gold);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: var(--nx-font);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }

    .nx-chapter-inline-btn:hover {
      background: var(--nx-gold);
      color: #000721;
      border-color: var(--nx-gold);
      transform: translateY(-1px) scale(1.03);
      box-shadow: 0 4px 12px var(--nx-gold-glow);
    }

    /* Modales */
    #nx-progress-modal-overlay,
    #nx-selection-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.78);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
      font-family: var(--nx-font);
    }

    #nx-progress-modal-overlay.nx-active,
    #nx-selection-modal-overlay.nx-active {
      opacity: 1;
      pointer-events: auto;
    }

    .nx-progress-modal,
    .nx-selection-modal {
      background: var(--nx-bg-card);
      border: 1px solid var(--nx-border);
      border-radius: var(--nx-radius);
      box-shadow: var(--nx-shadow);
      position: relative;
    }

    .nx-progress-modal {
      width: 90%;
      max-width: 440px;
      padding: 28px;
      text-align: center;
    }

    .nx-modal-title {
      color: var(--nx-text-primary);
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 6px 0;
    }

    .nx-modal-subtitle {
      color: var(--nx-text-muted);
      font-size: 13px;
      margin: 0 0 20px 0;
    }

    .nx-progress-track {
      width: 100%;
      height: 10px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    .nx-progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #ca9b2b 0%, var(--nx-gold) 100%);
      border-radius: 20px;
      transition: width 0.2s ease;
    }

    .nx-progress-status {
      font-size: 13px;
      color: var(--nx-gold);
      font-weight: 600;
      min-height: 20px;
    }

    .nx-modal-close-btn {
      position: absolute;
      top: 14px;
      right: 14px;
      background: none;
      border: none;
      color: var(--nx-text-muted);
      font-size: 20px;
      cursor: pointer;
    }

    /* Modale de sélection */
    .nx-selection-modal {
      width: 92%;
      max-width: 620px;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .nx-selection-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .nx-selection-header h3 {
      color: var(--nx-text-primary);
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 4px 0;
    }

    .nx-selection-summary-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      font-size: 12.5px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 8px;
      margin-top: 8px;
    }

    .nx-selection-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: rgba(0, 0, 0, 0.25);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      flex-wrap: wrap;
      gap: 10px;
    }

    .nx-toolbar-buttons {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nx-pill-btn {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: var(--nx-text-muted);
      font-size: 11.5px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .nx-pill-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }

    .nx-pill-btn.nx-active {
      background: rgba(226, 179, 57, 0.2);
      border-color: var(--nx-gold);
      color: var(--nx-gold);
    }

    .nx-pages-scrollbox {
      padding: 16px 24px;
      overflow-y: auto;
      max-height: 48vh;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .nx-page-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px 14px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .nx-page-row:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .nx-page-row.nx-selected {
      border-color: rgba(226, 179, 57, 0.4);
      background: rgba(226, 179, 57, 0.06);
    }

    .nx-page-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .nx-checkbox {
      width: 17px;
      height: 17px;
      accent-color: var(--nx-gold);
      cursor: pointer;
    }

    .nx-page-num {
      font-weight: 700;
      font-size: 13.5px;
      color: #fff;
    }

    .nx-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
    }

    .nx-badge-story {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
    }

    .nx-badge-promo {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fbbf24;
    }

    .nx-page-dim {
      font-size: 12px;
      color: var(--nx-text-muted);
      font-family: monospace;
    }

    .nx-selection-footer {
      padding: 16px 24px;
      background: rgba(0, 0, 0, 0.3);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .nx-remember-choice {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--nx-text-muted);
      cursor: pointer;
    }

    .nx-footer-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
    }

    .nx-btn-cancel {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: var(--nx-text-muted);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .nx-btn-confirm-dl {
      background: linear-gradient(135deg, var(--nx-gold) 0%, #ca9b2b 100%);
      color: #0b1329;
      border: none;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = CSS_STYLES;
  document.head.appendChild(styleEl);

  // --- CRYPTO & DÉCHIFFREMENT ---
  function base64UrlEncode(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlDecode(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(4 * Math.ceil(str.length / 4), '=');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      let t = Math.imul((seed = seed + 0x6d2b79f5 | 0) ^ (seed >>> 15), 1 | seed);
      return (((t = (t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t)) ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
  }

  function parseUrl(urlStr) {
    try {
      const url = new URL(urlStr, window.location.href);
      const parts = url.pathname.split('/').filter(Boolean);
      let serieSlug = null;
      let capSlug = null;
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        if (['comics', 'series', 'manhua', 'sakuhin'].includes(seg) && parts[i + 1]) serieSlug = parts[i + 1];
        if (['chapter', 'capitulo'].includes(seg) && parts[i + 1]) capSlug = parts[i + 1];
      }
      return { serieSlug, capSlug };
    } catch (_) {
      return { serieSlug: null, capSlug: null };
    }
  }

  function detectStoryPages(pages) {
    if (!pages || pages.length === 0) return [];
    const widthCounts = {};
    pages.forEach(p => {
      widthCounts[p.w] = (widthCounts[p.w] || 0) + 1;
    });

    let dominantWidth = pages[0].w;
    let maxCount = 0;
    for (const [w, count] of Object.entries(widthCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantWidth = Number(w);
      }
    }

    const total = pages.length;
    return pages.map((page, index) => {
      const ratio = page.h / page.w;
      let isStory = true;
      let reason = 'Page du récit';

      if (index === 0 && (ratio < 1.8 || page.w !== dominantWidth)) {
        isStory = false;
        reason = 'Intro / crédits team';
      } else if (index >= total - 3 && (ratio < 1.8 || page.w !== dominantWidth)) {
        isStory = false;
        reason = 'Fin / crédits / discord';
      } else if (ratio < 1.0 && (index <= 1 || index >= total - 4)) {
        isStory = false;
        reason = 'Bannière / annonce';
      }

      return { ...page, isStory, reason, ratio: Number(ratio.toFixed(2)) };
    });
  }

  async function getChapterData(serieSlug, capSlug) {
    const subtle = window.crypto.subtle;
    const clientKeyPair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const clientPubRaw = new Uint8Array(await subtle.exportKey('raw', clientKeyPair.publicKey));
    const xRsHeader = base64UrlEncode(clientPubRaw);

    const apiUrl = `${API_BASE}/series/${serieSlug}/capitulos/${capSlug}`;
    const res = await fetch(apiUrl, {
      headers: {
        'X-Rs': xRsHeader
      }
    });

    if (!res.ok) throw new Error(`Erreur API (HTTP ${res.status})`);
    const json = await res.json();
    const chapter = json.data;

    let seedsMap = {};
    if (chapter.r) {
      const wrapped = base64UrlDecode(chapter.r);
      const serverPubKey = await subtle.importKey('raw', wrapped.slice(0, 65), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const sharedBits = await subtle.deriveBits({ name: 'ECDH', public: serverPubKey }, clientKeyPair.privateKey, 256);
      const hkdfKey = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
      const aesKey = await subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('nexus:lector:v1') },
        hkdfKey,
        { name: 'AES-GCM', length: 128 },
        false,
        ['decrypt']
      );

      const decryptedPlain = await subtle.decrypt({ name: 'AES-GCM', iv: wrapped.slice(65, 77) }, aesKey, wrapped.slice(77));
      const decodedInfo = JSON.parse(new TextDecoder().decode(decryptedPlain));
      seedsMap = decodedInfo.s || {};
    }

    const pages = (chapter.paginas || []).map(p => {
      const pCopy = { ...p };
      if (pCopy.sc) pCopy.sc = { ...pCopy.sc, s: seedsMap[String(p.orden)] ?? 0 };
      return pCopy;
    });

    return { ...chapter, paginas: detectStoryPages(pages) };
  }

  async function downloadAndProcessPage(page, format = 'image/jpeg', quality = 0.95) {
    const res = await fetch(page.url);
    if (!res.ok) throw new Error(`Échec page ${page.orden}`);
    const imgData = await res.arrayBuffer();

    if (!page.sc) return new Blob([imgData], { type: format });

    const blob = new Blob([imgData]);
    const imgBitmap = await createImageBitmap(blob);
    const cols = page.sc.c;
    const rows = page.sc.r;
    const seed = page.sc.s;
    const version = page.sc.v ?? 1;
    const totalTiles = cols * rows;

    const tileW = Math.floor(imgBitmap.width / cols);
    const tileH = Math.floor(imgBitmap.height / rows);

    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(tileW * cols, tileH * rows)
      : document.createElement('canvas');

    canvas.width = tileW * cols;
    canvas.height = tileH * rows;
    const ctx = canvas.getContext('2d');

    const rng = mulberry32(seed >>> 0);
    const perm = Array.from({ length: totalTiles }, (_, i) => i);
    for (let t = totalTiles - 1; t > 0; t--) {
      const j = Math.floor(rng() * (t + 1));
      [perm[t], perm[j]] = [perm[j], perm[t]];
    }

    const flips = version >= 2 ? Array(totalTiles) : null;
    if (flips) {
      for (let t = 0; t < totalTiles; t++) flips[t] = Math.floor(4 * rng());
    }

    for (let t = 0; t < totalTiles; t++) {
      const r = perm[t];
      const sx = (t % cols) * tileW;
      const sy = Math.floor(t / cols) * tileH;
      const dx = (r % cols) * tileW;
      const dy = Math.floor(r / cols) * tileH;

      if (!flips || flips[t] === 0) {
        ctx.drawImage(imgBitmap, sx, sy, tileW, tileH, dx, dy, tileW, tileH);
        continue;
      }

      const flipH = (flips[t] & 1) !== 0;
      const flipV = (flips[t] & 2) !== 0;
      ctx.save();
      ctx.translate(flipH ? dx + tileW : dx, flipV ? dy + tileH : dy);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(imgBitmap, sx, sy, tileW, tileH, 0, 0, tileW, tileH);
      ctx.restore();
    }

    if (imgBitmap.close) imgBitmap.close();

    if (canvas.convertToBlob) {
      return await canvas.convertToBlob({ type: format, quality });
    }
    return new Promise((resolve) => canvas.toBlob(resolve, format, quality));
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  // --- INTERFACE UTILISATEUR ---
  let isDownloading = false;

  function getProgressModal() {
    let overlay = document.getElementById('nx-progress-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'nx-progress-modal-overlay';
      overlay.innerHTML = `
        <div class="nx-progress-modal">
          <button class="nx-modal-close-btn" id="nx-modal-close">✕</button>
          <h3 class="nx-modal-title" id="nx-modal-title">Téléchargement du Chapitre</h3>
          <p class="nx-modal-subtitle" id="nx-modal-subtitle">Déchiffrement et assemblage en cours...</p>
          <div class="nx-progress-track">
            <div class="nx-progress-bar" id="nx-progress-bar"></div>
          </div>
          <div class="nx-progress-status" id="nx-progress-status">Initialisation...</div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('nx-modal-close').addEventListener('click', () => {
        overlay.classList.remove('nx-active');
      });
    }
    return overlay;
  }

  function updateProgress(current, total, message) {
    const overlay = getProgressModal();
    overlay.classList.add('nx-active');
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    document.getElementById('nx-progress-bar').style.width = `${percent}%`;
    document.getElementById('nx-progress-status').textContent = message;
    if (total > 0) {
      document.getElementById('nx-modal-subtitle').textContent = `${percent}% (${current}/${total} pages)`;
    }
  }

  function showSelectionModal(chapter, serieSlug, capSlug, defaultFormat = 'image/jpeg') {
    let overlay = document.getElementById('nx-selection-modal-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'nx-selection-modal-overlay';

    const pages = chapter.paginas || [];
    const storyPages = pages.filter(p => p.isStory);
    const promoCount = pages.length - storyPages.length;
    const chapNum = chapter.numero !== undefined ? chapter.numero : capSlug;
    const selectedOrders = new Set(storyPages.map(p => p.orden));

    overlay.innerHTML = `
      <div class="nx-selection-modal">
        <button class="nx-modal-close-btn" id="nx-select-close">✕</button>
        <div class="nx-selection-header">
          <h3>📥 Télécharger : Ch.${chapNum}</h3>
          <div class="nx-selection-summary-badge">
            <span>🎯 <strong>${storyPages.length}</strong> pages de récit détectées sur ${pages.length} (${promoCount} crédits/bannières filtrés)</span>
          </div>
        </div>
        <div class="nx-selection-toolbar">
          <div class="nx-toolbar-buttons">
            <button class="nx-pill-btn nx-active" id="nx-btn-filter-story">🎯 Récit seul (${storyPages.length})</button>
            <button class="nx-pill-btn" id="nx-btn-filter-all">☑️ Tout (${pages.length})</button>
            <button class="nx-pill-btn" id="nx-btn-filter-none">❌ Rien</button>
          </div>
          <select class="nx-format-select" id="nx-modal-format">
            <option value="image/jpeg">JPG (Qualité 95%)</option>
            <option value="image/png">PNG (Sans perte)</option>
          </select>
        </div>
        <div class="nx-pages-scrollbox" id="nx-pages-list"></div>
        <div class="nx-selection-footer">
          <label class="nx-remember-choice">
            <input type="checkbox" id="nx-remember-auto">
            <span>Toujours télécharger le récit sans demander</span>
          </label>
          <div class="nx-footer-actions">
            <button class="nx-btn-cancel" id="nx-modal-cancel">Annuler</button>
            <button class="nx-btn-confirm-dl" id="nx-modal-confirm">
              🚀 Télécharger (<span id="nx-selected-count">${selectedOrders.size}</span> pages) (.ZIP)
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const listContainer = document.getElementById('nx-pages-list');
    const confirmBtn = document.getElementById('nx-modal-confirm');
    const countSpan = document.getElementById('nx-selected-count');

    function renderPageRows() {
      listContainer.innerHTML = '';
      pages.forEach(p => {
        const isChecked = selectedOrders.has(p.orden);
        const row = document.createElement('div');
        row.className = `nx-page-row ${isChecked ? 'nx-selected' : ''}`;
        const badgeClass = p.isStory ? 'nx-badge-story' : 'nx-badge-promo';
        const badgeText = p.isStory ? '📖 Récit' : `📢 ${p.reason}`;

        row.innerHTML = `
          <div class="nx-page-left">
            <input type="checkbox" class="nx-checkbox" ${isChecked ? 'checked' : ''}>
            <span class="nx-page-num">Page ${p.orden}</span>
            <span class="nx-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="nx-page-dim">${p.w} × ${p.h} px</div>
        `;

        row.addEventListener('click', (e) => {
          if (e.target.tagName !== 'INPUT') {
            const cb = row.querySelector('input');
            cb.checked = !cb.checked;
          }
          const cb = row.querySelector('input');
          if (cb.checked) {
            selectedOrders.add(p.orden);
            row.classList.add('nx-selected');
          } else {
            selectedOrders.delete(p.orden);
            row.classList.remove('nx-selected');
          }
          countSpan.textContent = selectedOrders.size;
          confirmBtn.disabled = selectedOrders.size === 0;
        });

        listContainer.appendChild(row);
      });
    }

    document.getElementById('nx-btn-filter-story').addEventListener('click', () => {
      selectedOrders.clear();
      storyPages.forEach(p => selectedOrders.add(p.orden));
      renderPageRows();
      countSpan.textContent = selectedOrders.size;
    });

    document.getElementById('nx-btn-filter-all').addEventListener('click', () => {
      pages.forEach(p => selectedOrders.add(p.orden));
      renderPageRows();
      countSpan.textContent = selectedOrders.size;
    });

    document.getElementById('nx-btn-filter-none').addEventListener('click', () => {
      selectedOrders.clear();
      renderPageRows();
      countSpan.textContent = 0;
    });

    document.getElementById('nx-select-close').addEventListener('click', () => overlay.classList.remove('nx-active'));
    document.getElementById('nx-modal-cancel').addEventListener('click', () => overlay.classList.remove('nx-active'));

    confirmBtn.addEventListener('click', () => {
      const remember = document.getElementById('nx-remember-auto').checked;
      localStorage.setItem('nx_auto_download_story', String(remember));
      const format = document.getElementById('nx-modal-format').value;
      const orders = Array.from(selectedOrders);
      overlay.classList.remove('nx-active');
      startDownloadWithOrders(serieSlug, capSlug, chapter, orders, format);
    });

    renderPageRows();
    const rememberCb = document.getElementById('nx-remember-auto');
    if (rememberCb) {
      rememberCb.checked = (localStorage.getItem('nx_auto_download_story') === 'true');
    }
    requestAnimationFrame(() => overlay.classList.add('nx-active'));
  }

  async function startDownloadWithOrders(serieSlug, capSlug, chapter, selectedOrders, format = 'image/jpeg') {
    if (isDownloading) return;
    isDownloading = true;

    try {
      const pages = chapter.paginas.filter(p => selectedOrders.includes(p.orden));
      const totalPages = pages.length;
      const chapNum = chapter.numero !== undefined ? chapter.numero : capSlug;
      const zipFileName = `[NexusScan] ${serieSlug} - Ch.${chapNum}.zip`;

      const zip = new window.JSZip();
      const folder = zip.folder(`Ch.${chapNum}`) || zip;

      const concurrency = 3;
      let completed = 0;

      for (let i = 0; i < pages.length; i += concurrency) {
        const batch = pages.slice(i, i + concurrency);
        await Promise.all(batch.map(async (p, bIdx) => {
          const blob = await downloadAndProcessPage(p, format, 0.95);
          const ext = format === 'image/png' ? 'png' : 'jpg';
          const name = `${String(i + bIdx + 1).padStart(3, '0')}.${ext}`;
          folder.file(name, blob);
          completed++;
          updateProgress(completed, totalPages, `Page ${completed} / ${totalPages} traitée...`);
        }));
      }

      updateProgress(totalPages, totalPages, 'Génération du fichier ZIP...');
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });

      triggerDownload(zipBlob, zipFileName);
      updateProgress(totalPages, totalPages, 'Téléchargement lancé avec succès ! 🎉');

      setTimeout(() => {
        getProgressModal().classList.remove('nx-active');
        isDownloading = false;
      }, 2500);

    } catch (err) {
      alert(`Erreur : ${err.message}`);
      updateProgress(0, 0, `Erreur : ${err.message}`);
      isDownloading = false;
    }
  }

  async function openSelectionOrDownload(serieSlug, capSlug, format = 'image/jpeg') {
    if (isDownloading) {
      alert('Un téléchargement est déjà en cours. Veuillez patienter.');
      return;
    }

    try {
      updateProgress(0, 1, 'Chargement des informations...');
      const chapter = await getChapterData(serieSlug, capSlug);
      getProgressModal().classList.remove('nx-active');

      if (localStorage.getItem('nx_auto_download_story') === 'true') {
        const storyOrders = chapter.paginas.filter(p => p.isStory).map(p => p.orden);
        startDownloadWithOrders(serieSlug, capSlug, chapter, storyOrders, format);
      } else {
        showSelectionModal(chapter, serieSlug, capSlug, format);
      }
    } catch (err) {
      alert(`Erreur : ${err.message}`);
      getProgressModal().classList.remove('nx-active');
    }
  }

  function injectUi() {
    const { serieSlug, capSlug } = parseUrl(window.location.href);

    if (capSlug && serieSlug) {
      let panel = document.getElementById('nx-floating-panel');
      if (!panel) {
        const isAuto = (localStorage.getItem('nx_auto_download_story') === 'true');
        panel = document.createElement('div');
        panel.id = 'nx-floating-panel';
        panel.innerHTML = `
          <div class="nx-brand-badge">⚡ Nexus DL</div>
          <button class="nx-pill-btn ${isAuto ? 'nx-active' : ''}" id="nx-btn-toggle-auto" title="${isAuto ? 'Mode 1-clic direct ACTIF (cliquer pour désactiver)' : 'Mode confirmation ACTIF (cliquer pour activer 1-clic)'}">
            ${isAuto ? '⚡ 1-clic' : '📋 Sélection'}
          </button>
          <select class="nx-format-select" id="nx-format-choice">
            <option value="image/jpeg">JPG</option>
            <option value="image/png">PNG</option>
          </select>
          <button class="nx-btn-download" id="nx-btn-chapter-dl">📥 Télécharger ZIP</button>
        `;
        document.body.appendChild(panel);

        const toggleBtn = document.getElementById('nx-btn-toggle-auto');
        toggleBtn.addEventListener('click', () => {
          const current = (localStorage.getItem('nx_auto_download_story') === 'true');
          const next = !current;
          localStorage.setItem('nx_auto_download_story', String(next));
          toggleBtn.textContent = next ? '⚡ 1-clic' : '📋 Sélection';
          toggleBtn.classList.toggle('nx-active', next);
          toggleBtn.title = next ? 'Mode 1-clic direct ACTIF (cliquer pour désactiver)' : 'Mode confirmation ACTIF (cliquer pour activer 1-clic)';
        });

        document.getElementById('nx-btn-chapter-dl').addEventListener('click', () => {
          const format = document.getElementById('nx-format-choice').value;
          openSelectionOrDownload(serieSlug, capSlug, format);
        });
      }
    } else {
      document.getElementById('nx-floating-panel')?.remove();
    }

    if (serieSlug && !capSlug) {
      document.querySelectorAll('.grid > .nx-chapter-inline-btn').forEach(b => b.remove());

      document.querySelectorAll('a[href*="/chapter/"], a[href*="/capitulo/"]').forEach(link => {
        if (link.querySelector('.nx-chapter-inline-btn')) return;

        const parsed = parseUrl(link.getAttribute('href'));
        if (!parsed.capSlug) return;

        const btn = document.createElement('button');
        btn.className = 'nx-chapter-inline-btn';
        btn.type = 'button';
        btn.innerHTML = `📥 <span>ZIP</span>`;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openSelectionOrDownload(serieSlug, parsed.capSlug, 'image/jpeg');
        });

        const chevron = link.querySelector('svg:last-child');
        if (chevron && chevron.parentElement === link) {
          link.insertBefore(btn, chevron);
        } else {
          link.appendChild(btn);
        }
      });
    }
  }

  setInterval(injectUi, 1200);
  injectUi();
})();
