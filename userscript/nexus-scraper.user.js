// ==UserScript==
// @name         Nexus Scanlation Manhwa Downloader
// @namespace    https://nexusscanlation.com/
// @version      1.0.0
// @description  Téléchargeur complet de chapitres Manhwa en archive ZIP pour NexusScanlation (reconstitution et déchiffrement automatiques).
// @author       NexusScraper
// @match        https://nexusscanlation.com/*
// @match        https://*.nexusscanlation.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.nexusscanlation.com
// @connect      cdn.nexusscanlation.com
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
      --nx-bg-card: rgba(15, 27, 54, 0.95);
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

    #nx-progress-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
      font-family: var(--nx-font);
    }

    #nx-progress-modal-overlay.nx-active {
      opacity: 1;
      pointer-events: auto;
    }

    .nx-progress-modal {
      background: var(--nx-bg-card);
      border: 1px solid var(--nx-border);
      border-radius: var(--nx-radius);
      width: 90%;
      max-width: 440px;
      padding: 28px;
      box-shadow: var(--nx-shadow);
      text-align: center;
      position: relative;
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

    .nx-chapter-inline-btn {
      display: inline-flex;
      align-items: center;
      background: rgba(226, 179, 57, 0.12);
      border: 1px solid rgba(226, 179, 57, 0.35);
      color: var(--nx-gold);
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      margin-left: 8px;
      transition: all 0.2s ease;
    }

    .nx-chapter-inline-btn:hover {
      background: var(--nx-gold);
      color: #0b1329;
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

    return { ...chapter, paginas: pages };
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

  async function startDownload(serieSlug, capSlug, format = 'image/jpeg') {
    if (isDownloading) return;
    isDownloading = true;

    try {
      updateProgress(0, 1, 'Récupération des métadonnées...');
      const chapter = await getChapterData(serieSlug, capSlug);
      const pages = chapter.paginas || [];
      const totalPages = pages.length;

      const chapNum = chapter.numero !== undefined ? chapter.numero : capSlug;
      const zipFileName = `[NexusScan] ${serieSlug} - Ch.${chapNum}.zip`;

      const zip = new window.JSZip();
      const folder = zip.folder(`Ch.${chapNum}`) || zip;

      const concurrency = 3;
      let completed = 0;

      for (let i = 0; i < pages.length; i += concurrency) {
        const batch = pages.slice(i, i + concurrency);
        await Promise.all(batch.map(async (p) => {
          const blob = await downloadAndProcessPage(p, format, 0.95);
          const ext = format === 'image/png' ? 'png' : 'jpg';
          const name = `${String(p.orden).padStart(3, '0')}.${ext}`;
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

  function injectUi() {
    const { serieSlug, capSlug } = parseUrl(window.location.href);

    if (capSlug && serieSlug) {
      let panel = document.getElementById('nx-floating-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'nx-floating-panel';
        panel.innerHTML = `
          <div class="nx-brand-badge">⚡ Nexus DL</div>
          <select class="nx-format-select" id="nx-format-choice">
            <option value="image/jpeg">JPG</option>
            <option value="image/png">PNG</option>
          </select>
          <button class="nx-btn-download" id="nx-btn-chapter-dl">📥 Télécharger ZIP</button>
        `;
        document.body.appendChild(panel);

        document.getElementById('nx-btn-chapter-dl').addEventListener('click', () => {
          const format = document.getElementById('nx-format-choice').value;
          startDownload(serieSlug, capSlug, format);
        });
      }
    } else {
      document.getElementById('nx-floating-panel')?.remove();
    }

    if (serieSlug && !capSlug) {
      document.querySelectorAll('a[href*="/chapter/"], a[href*="/capitulo/"]').forEach(link => {
        if (link.dataset.nxInjected) return;
        link.dataset.nxInjected = 'true';
        const parsed = parseUrl(link.getAttribute('href'));
        if (!parsed.capSlug) return;

        const btn = document.createElement('button');
        btn.className = 'nx-chapter-inline-btn';
        btn.textContent = '📥 ZIP';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          startDownload(serieSlug, parsed.capSlug, 'image/jpeg');
        });
        link.parentElement?.appendChild(btn);
      });
    }
  }

  setInterval(injectUi, 1200);
  injectUi();
})();
