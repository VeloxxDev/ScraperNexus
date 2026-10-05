/**
 * Nexus Scraper - Content Script
 * Injecte les boutons de téléchargement et gère l'UI de progression
 */

(function () {
  'use strict';

  // Éviter les injections multiples
  if (window.__nxScraperInjected) return;
  window.__nxScraperInjected = true;

  let isDownloading = false;

  /**
   * Icône SVG de téléchargement
   */
  const SVG_DOWNLOAD = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  `;

  const SVG_SPINNER = `
    <svg class="nx-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: nx-rotate 1s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M12 2a10 10 0 0 1 10 10"></path>
    </svg>
    <style>@keyframes nx-rotate { 100% { transform: rotate(360deg); } }</style>
  `;

  /**
   * Création ou récupération de la modale de progression
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
        if (!isDownloading) {
          overlay.classList.remove('nx-active');
        } else {
          if (confirm('Un téléchargement est en cours. Voulez-vous masquer cette fenêtre ? Le téléchargement continuera en arrière-plan.')) {
            overlay.classList.remove('nx-active');
          }
        }
      });
    }
    return overlay;
  }

  /**
   * Met à jour l'UI de la modale de progression
   */
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
   * Lance le téléchargement d'un chapitre
   */
  async function startChapterDownload(serieSlug, capSlug, format = 'image/jpeg') {
    if (isDownloading) {
      alert('Un téléchargement est déjà en cours. Veuillez patienter.');
      return;
    }

    isDownloading = true;
    const overlay = getProgressModal();
    overlay.classList.add('nx-active');

    try {
      updateProgress(0, 1, 'Connexion à l\'API NexusScan...', `Chapitre : ${capSlug}`);

      const result = await window.ScraperCore.downloadChapterAsZip(serieSlug, capSlug, {
        format,
        quality: 0.95,
        zipInstance: window.JSZip,
        onProgress: (current, total, message) => {
          updateProgress(current, total, message);
        }
      });

      updateProgress(result.totalPages, result.totalPages, 'Téléchargement du fichier ZIP...');
      window.ScraperCore.triggerDownload(result.blob, result.filename);

      setTimeout(() => {
        updateProgress(result.totalPages, result.totalPages, 'Terminé avec succès ! 🎉');
        setTimeout(() => {
          overlay.classList.remove('nx-active');
          isDownloading = false;
        }, 2500);
      }, 500);

    } catch (err) {
      console.error('Erreur ScraperNexus:', err);
      updateProgress(0, 0, `Erreur : ${err.message}`);
      alert(`Erreur lors du téléchargement : ${err.message}`);
      isDownloading = false;
    }
  }

  /**
   * Injection du panneau flottant sur la page de lecture d'un chapitre
   */
  function injectFloatingChapterPanel(serieSlug, capSlug) {
    let panel = document.getElementById('nx-floating-panel');
    if (panel) {
      panel.dataset.serieSlug = serieSlug;
      panel.dataset.capSlug = capSlug;
      return;
    }

    panel = document.createElement('div');
    panel.id = 'nx-floating-panel';
    panel.dataset.serieSlug = serieSlug;
    panel.dataset.capSlug = capSlug;

    panel.innerHTML = `
      <div class="nx-brand-badge">
        ${SVG_DOWNLOAD}
        <span>Nexus DL</span>
      </div>
      <select class="nx-format-select" id="nx-format-choice" title="Format d'image">
        <option value="image/jpeg">JPG (Qualité 95%)</option>
        <option value="image/png">PNG (Sans perte)</option>
      </select>
      <button class="nx-btn-download" id="nx-btn-chapter-dl">
        ${SVG_DOWNLOAD}
        <span>Télécharger ZIP</span>
      </button>
    `;

    document.body.appendChild(panel);

    const btn = document.getElementById('nx-btn-chapter-dl');
    btn.addEventListener('click', () => {
      const currentSerie = panel.dataset.serieSlug;
      const currentCap = panel.dataset.capSlug;
      const format = document.getElementById('nx-format-choice').value;
      startChapterDownload(currentSerie, currentCap, format);
    });
  }

  /**
   * Supprime le panneau flottant si on n'est plus sur un chapitre
   */
  function removeFloatingChapterPanel() {
    const panel = document.getElementById('nx-floating-panel');
    if (panel) panel.remove();
  }

  /**
   * Injection des boutons de téléchargement inline sur la page de la série
   */
  function injectSeriesChapterButtons(serieSlug) {
    // Sélectionner les liens vers les chapitres sur la page
    const chapterLinks = document.querySelectorAll('a[href*="/chapter/"], a[href*="/capitulo/"]');

    chapterLinks.forEach(link => {
      if (link.dataset.nxInjected) return;
      link.dataset.nxInjected = 'true';

      const href = link.getAttribute('href');
      const { capSlug } = window.ScraperCore.parseUrl(href);
      if (!capSlug) return;

      const btn = document.createElement('button');
      btn.className = 'nx-chapter-inline-btn';
      btn.innerHTML = `📥 ZIP`;
      btn.title = `Télécharger ${capSlug} en ZIP`;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startChapterDownload(serieSlug, capSlug, 'image/jpeg');
      });

      // Insérer le bouton à côté du lien ou dans son parent
      link.parentElement?.appendChild(btn);
    });
  }

  /**
   * Analyse l'URL actuelle et adapte l'interface
   */
  function checkAndAdaptUi() {
    const { serieSlug, capSlug } = window.ScraperCore.parseUrl(window.location.href);

    if (capSlug && serieSlug) {
      // Nous sommes sur une page de chapitre
      injectFloatingChapterPanel(serieSlug, capSlug);
    } else {
      removeFloatingChapterPanel();
    }

    if (serieSlug && !capSlug) {
      // Nous sommes sur la page d'une série (catalogue des chapitres)
      injectSeriesChapterButtons(serieSlug);
    }
  }

  // Surveillance des navigations SPA (Next.js)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      checkAndAdaptUi();
    } else {
      // Pour les séries chargées dynamiquement
      const { serieSlug, capSlug } = window.ScraperCore.parseUrl(window.location.href);
      if (serieSlug && !capSlug) {
        injectSeriesChapterButtons(serieSlug);
      }
    }
  }, 1200);

  // Initialisation au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndAdaptUi);
  } else {
    checkAndAdaptUi();
  }
})();
