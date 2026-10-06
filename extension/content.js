/**
 * Nexus Scraper - Content Script
 * Détection intelligente des pages de récit, sélection interactive et boutons intégrés
 */

(function () {
  'use strict';

  if (window.__nxScraperInjected) return;
  window.__nxScraperInjected = true;

  let isDownloading = false;

  const SVG_DOWNLOAD = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  `;

  /**
   * Modale de progression
   */
  function getProgressModal() {
    let overlay = document.getElementById('nx-progress-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'nx-progress-modal-overlay';
      overlay.innerHTML = `
        <div class="nx-progress-modal">
          <button class="nx-modal-close-btn" id="nx-modal-close" title="Fermer">✕</button>
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
        if (!isDownloading || confirm('Masquer cette fenêtre ? Le téléchargement continuera en arrière-plan.')) {
          overlay.classList.remove('nx-active');
        }
      });
    }
    return overlay;
  }

  function updateProgress(current, total, message, title = null) {
    const overlay = getProgressModal();
    overlay.classList.add('nx-active');

    if (title) {
      document.getElementById('nx-modal-title').textContent = title;
    }

    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const bar = document.getElementById('nx-progress-bar');
    const status = document.getElementById('nx-progress-status');
    const subtitle = document.getElementById('nx-modal-subtitle');

    if (bar) bar.style.width = `${percent}%`;
    if (status) status.textContent = message;
    if (subtitle && total > 0) {
      subtitle.textContent = `${percent}% (${current}/${total} pages)`;
    }
  }

  /**
   * Modale de sélection et prévisualisation des pages
   */
  function showSelectionModal(chapter, serieSlug, capSlug, defaultFormat = 'image/jpeg') {
    let overlay = document.getElementById('nx-selection-modal-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'nx-selection-modal-overlay';

    const pages = chapter.paginas || [];
    const storyPages = pages.filter(p => p.isStory);
    const promoCount = pages.length - storyPages.length;
    const chapNum = chapter.numero !== undefined ? chapter.numero : capSlug;

    // État local des cases cochées (par défaut, uniquement les pages d'histoire)
    const selectedOrders = new Set(storyPages.map(p => p.orden));

    overlay.innerHTML = `
      <div class="nx-selection-modal">
        <button class="nx-modal-close-btn" id="nx-select-close" title="Fermer">✕</button>
        
        <div class="nx-selection-header">
          <h3>${SVG_DOWNLOAD} Télécharger : Ch.${chapNum}</h3>
          <div class="nx-selection-summary-badge">
            <span>🎯 <strong>${storyPages.length}</strong> pages de récit détectées sur ${pages.length} (${promoCount} crédits/bannières écartés)</span>
          </div>
        </div>

        <div class="nx-selection-toolbar">
          <div class="nx-toolbar-buttons">
            <button class="nx-pill-btn nx-active" id="nx-btn-filter-story">🎯 Récit uniquement (${storyPages.length})</button>
            <button class="nx-pill-btn" id="nx-btn-filter-all">☑️ Tout sélectionner (${pages.length})</button>
            <button class="nx-pill-btn" id="nx-btn-filter-none">❌ Tout décocher</button>
          </div>
          <select class="nx-format-select" id="nx-modal-format">
            <option value="image/jpeg" ${defaultFormat === 'image/jpeg' ? 'selected' : ''}>JPG (Qualité 95%)</option>
            <option value="image/png" ${defaultFormat === 'image/png' ? 'selected' : ''}>PNG (Sans perte)</option>
          </select>
        </div>

        <div class="nx-pages-scrollbox" id="nx-pages-list"></div>

        <div class="nx-selection-footer">
          <label class="nx-remember-choice" title="Ne plus afficher cette fenêtre et télécharger directement le récit en 1 clic">
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
    const btnStory = document.getElementById('nx-btn-filter-story');
    const btnAll = document.getElementById('nx-btn-filter-all');
    const btnNone = document.getElementById('nx-btn-filter-none');

    function renderPageRows() {
      listContainer.innerHTML = '';
      pages.forEach(p => {
        const isChecked = selectedOrders.has(p.orden);
        const row = document.createElement('div');
        row.className = `nx-page-row ${isChecked ? 'nx-selected' : ''}`;
        row.dataset.orden = p.orden;

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
          updateCount();
        });

        listContainer.appendChild(row);
      });
    }

    function updateCount() {
      countSpan.textContent = selectedOrders.size;
      confirmBtn.disabled = selectedOrders.size === 0;

      btnStory.classList.toggle('nx-active', selectedOrders.size === storyPages.length && Array.from(selectedOrders).every(o => storyPages.some(sp => sp.orden === o)));
      btnAll.classList.toggle('nx-active', selectedOrders.size === pages.length);
      btnNone.classList.toggle('nx-active', selectedOrders.size === 0);
    }

    btnStory.addEventListener('click', () => {
      selectedOrders.clear();
      storyPages.forEach(p => selectedOrders.add(p.orden));
      renderPageRows();
      updateCount();
    });

    btnAll.addEventListener('click', () => {
      pages.forEach(p => selectedOrders.add(p.orden));
      renderPageRows();
      updateCount();
    });

    btnNone.addEventListener('click', () => {
      selectedOrders.clear();
      renderPageRows();
      updateCount();
    });

    document.getElementById('nx-select-close').addEventListener('click', () => overlay.classList.remove('nx-active'));
    document.getElementById('nx-modal-cancel').addEventListener('click', () => overlay.classList.remove('nx-active'));

    confirmBtn.addEventListener('click', () => {
      const remember = document.getElementById('nx-remember-auto').checked;
      setAutoDownloadEnabled(remember);

      const format = document.getElementById('nx-modal-format').value;
      const ordersToDownload = Array.from(selectedOrders);

      overlay.classList.remove('nx-active');
      executeZipDownload(serieSlug, capSlug, chapter, ordersToDownload, format);
    });

    renderPageRows();
    updateCount();

    // Initialiser l'état de la case "Toujours télécharger sans demander"
    isAutoDownloadEnabled().then(auto => {
      const cb = document.getElementById('nx-remember-auto');
      if (cb) cb.checked = auto;
    });

    // Activer l'animation d'ouverture
    requestAnimationFrame(() => overlay.classList.add('nx-active'));
  }

  /**
   * Exécute le téléchargement en arrière-plan avec la modale de progression
   */
  async function executeZipDownload(serieSlug, capSlug, preloadedChapter, selectedPageOrders, format) {
    if (isDownloading) return;
    isDownloading = true;

    const overlay = getProgressModal();
    overlay.classList.add('nx-active');

    try {
      updateProgress(0, selectedPageOrders.length, 'Démarrage du téléchargement...', `Chapitre : ${capSlug}`);

      const result = await window.ScraperCore.downloadChapterAsZip(serieSlug, capSlug, {
        format,
        quality: 0.95,
        zipInstance: window.JSZip,
        chapterData: preloadedChapter,
        selectedPageOrders,
        onProgress: (current, total, message) => {
          updateProgress(current, total, message);
        }
      });

      updateProgress(result.totalPages, result.totalPages, 'Téléchargement de l\'archive ZIP...');
      window.ScraperCore.triggerDownload(result.blob, result.filename);

      setTimeout(() => {
        updateProgress(result.totalPages, result.totalPages, 'Téléchargement terminé ! 🎉');
        setTimeout(() => {
          overlay.classList.remove('nx-active');
          isDownloading = false;
        }, 2200);
      }, 500);

    } catch (err) {
      console.error('Erreur ScraperNexus:', err);
      updateProgress(0, 0, `Erreur : ${err.message}`);
      alert(`Erreur lors du téléchargement : ${err.message}`);
      isDownloading = false;
    }
  }

  /**
   * Gestion de la préférence auto-download (synchronisée avec chrome.storage et localStorage)
   */
  async function isAutoDownloadEnabled() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const res = await new Promise(resolve => chrome.storage.local.get(['nx_auto_download_story'], resolve));
        if (res && res.nx_auto_download_story !== undefined) {
          return Boolean(res.nx_auto_download_story);
        }
      } catch (_) {}
    }
    return localStorage.getItem('nx_auto_download_story') === 'true';
  }

  function setAutoDownloadEnabled(val) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        chrome.storage.local.set({ nx_auto_download_story: Boolean(val) });
      } catch (_) {}
    }
    localStorage.setItem('nx_auto_download_story', String(Boolean(val)));
  }

  // Écouter les messages envoyés depuis le popup de l'extension
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'NX_SYNC_AUTO_DOWNLOAD') {
        localStorage.setItem('nx_auto_download_story', String(Boolean(msg.value)));
        const gearBtn = document.getElementById('nx-btn-toggle-auto');
        if (gearBtn) {
          gearBtn.title = msg.value ? 'Mode 1-clic direct : ACTIF (cliquer pour désactiver)' : 'Mode 1-clic direct : INACTIF (cliquer pour activer)';
          gearBtn.classList.toggle('nx-active', Boolean(msg.value));
        }
      }
    });
  }

  /**
   * Point d'entrée pour lancer le téléchargement (avec sélection ou direct)
   */
  async function openSelectionOrDownload(serieSlug, capSlug, format = 'image/jpeg') {
    if (isDownloading) {
      alert('Un téléchargement est déjà en cours. Veuillez patienter.');
      return;
    }

    try {
      // Afficher un petit état d'attente
      updateProgress(0, 1, 'Chargement des informations du chapitre...', 'Analyse du chapitre');

      const chapter = await window.ScraperCore.getChapterData(serieSlug, capSlug);
      getProgressModal().classList.remove('nx-active');

      // Vérifier si le mode automatique sans confirmation est activé
      const isAuto = await isAutoDownloadEnabled();
      if (isAuto) {
        const storyOrders = chapter.paginas.filter(p => p.isStory).map(p => p.orden);
        executeZipDownload(serieSlug, capSlug, chapter, storyOrders, format);
      } else {
        showSelectionModal(chapter, serieSlug, capSlug, format);
      }
    } catch (err) {
      console.error('Erreur ScraperNexus:', err);
      alert(`Impossible de charger le chapitre : ${err.message}`);
      getProgressModal().classList.remove('nx-active');
    }
  }

  /**
   * Injection du panneau flottant sur la page de lecture d'un chapitre
   */
  async function injectFloatingChapterPanel(serieSlug, capSlug) {
    let panel = document.getElementById('nx-floating-panel');
    if (panel) {
      panel.dataset.serieSlug = serieSlug;
      panel.dataset.capSlug = capSlug;
      return;
    }

    const isAuto = await isAutoDownloadEnabled();

    panel = document.createElement('div');
    panel.id = 'nx-floating-panel';
    panel.dataset.serieSlug = serieSlug;
    panel.dataset.capSlug = capSlug;

    panel.innerHTML = `
      <div class="nx-brand-badge">
        ${SVG_DOWNLOAD}
        <span>Nexus DL</span>
      </div>
      <button class="nx-pill-btn ${isAuto ? 'nx-active' : ''}" id="nx-btn-toggle-auto" title="${isAuto ? 'Mode 1-clic direct ACTIF (cliquer pour désactiver)' : 'Mode confirmation ACTIF (cliquer pour activer 1-clic)'}">
        ${isAuto ? '⚡ 1-clic' : '📋 Sélection'}
      </button>
      <select class="nx-format-select" id="nx-format-choice" title="Format d'image">
        <option value="image/jpeg">JPG</option>
        <option value="image/png">PNG</option>
      </select>
      <button class="nx-btn-download" id="nx-btn-chapter-dl">
        ${SVG_DOWNLOAD}
        <span>Télécharger ZIP</span>
      </button>
    `;

    document.body.appendChild(panel);

    // Bouton bascule 1-clic directement sur le panneau flottant
    const toggleBtn = document.getElementById('nx-btn-toggle-auto');
    toggleBtn.addEventListener('click', async () => {
      const current = await isAutoDownloadEnabled();
      const next = !current;
      setAutoDownloadEnabled(next);
      toggleBtn.textContent = next ? '⚡ 1-clic' : '📋 Sélection';
      toggleBtn.classList.toggle('nx-active', next);
      toggleBtn.title = next ? 'Mode 1-clic direct ACTIF (cliquer pour désactiver)' : 'Mode confirmation ACTIF (cliquer pour activer 1-clic)';
    });

    document.getElementById('nx-btn-chapter-dl').addEventListener('click', () => {
      const currentSerie = panel.dataset.serieSlug;
      const currentCap = panel.dataset.capSlug;
      const format = document.getElementById('nx-format-choice').value;
      openSelectionOrDownload(currentSerie, currentCap, format);
    });
  }

  function removeFloatingChapterPanel() {
    document.getElementById('nx-floating-panel')?.remove();
  }

  /**
   * Injection propre des boutons dans les cartes de chapitres (page série)
   */
  function injectSeriesChapterButtons(serieSlug) {
    // 1. Nettoyer tout bouton orphelin qui aurait été injecté dans la grille par erreur
    document.querySelectorAll('.grid > .nx-chapter-inline-btn').forEach(btn => btn.remove());

    // 2. Sélectionner toutes les cartes de chapitre (liens contenant /chapter/ ou /capitulo/)
    const chapterLinks = document.querySelectorAll('a[href*="/chapter/"], a[href*="/capitulo/"]');

    chapterLinks.forEach(link => {
      // Si le bouton est déjà intégré dans cette carte, on ne fait rien
      if (link.querySelector('.nx-chapter-inline-btn')) return;

      const href = link.getAttribute('href');
      const { capSlug } = window.ScraperCore.parseUrl(href);
      if (!capSlug) return;

      const btn = document.createElement('button');
      btn.className = 'nx-chapter-inline-btn';
      btn.type = 'button';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>ZIP</span>
      `;
      btn.title = `Télécharger le chapitre ${capSlug} en ZIP`;

      btn.addEventListener('click', (e) => {
        // Empêcher la navigation vers le chapitre
        e.preventDefault();
        e.stopPropagation();
        openSelectionOrDownload(serieSlug, capSlug, 'image/jpeg');
      });

      // Insérer le bouton à l'intérieur de la carte link :
      // On cherche le chevron de fin s'il existe, sinon on l'ajoute à la fin du lien
      const chevron = link.querySelector('svg:last-child');
      if (chevron && chevron.parentElement === link) {
        link.insertBefore(btn, chevron);
      } else {
        link.appendChild(btn);
      }
    });
  }

  /**
   * Analyse et adaptation de l'interface
   */
  function checkAndAdaptUi() {
    const { serieSlug, capSlug } = window.ScraperCore.parseUrl(window.location.href);

    if (capSlug && serieSlug) {
      injectFloatingChapterPanel(serieSlug, capSlug);
    } else {
      removeFloatingChapterPanel();
    }

    if (serieSlug && !capSlug) {
      injectSeriesChapterButtons(serieSlug);
    }
  }

  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      checkAndAdaptUi();
    } else {
      const { serieSlug, capSlug } = window.ScraperCore.parseUrl(window.location.href);
      if (serieSlug && !capSlug) {
        injectSeriesChapterButtons(serieSlug);
      }
    }
  }, 1200);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndAdaptUi);
  } else {
    checkAndAdaptUi();
  }
})();
