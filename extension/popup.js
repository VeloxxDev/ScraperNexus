/**
 * Nexus Scraper - Popup JS
 */

document.addEventListener('DOMContentLoaded', async () => {
  const tabInfoEl = document.getElementById('nx-tab-info');
  const btnDlActive = document.getElementById('nx-btn-dl-active');
  const customUrlInput = document.getElementById('nx-custom-url');
  const btnDlCustom = document.getElementById('nx-btn-dl-custom');
  const formatSelect = document.getElementById('nx-popup-format');

  const progressBox = document.getElementById('nx-progress-box');
  const progressMsg = document.getElementById('nx-progress-msg');
  const progressFill = document.getElementById('nx-progress-fill');
  const progressSub = document.getElementById('nx-progress-sub');

  let activeSerie = null;
  let activeCap = null;

  function setProgress(current, total, message) {
    progressBox.style.display = 'flex';
    progressMsg.textContent = message;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    progressFill.style.width = `${percent}%`;
    progressSub.textContent = `${percent}% (${current}/${total} pages)`;
  }

  async function executeDownload(serieSlug, capSlug) {
    btnDlActive.disabled = true;
    btnDlCustom.disabled = true;

    try {
      setProgress(0, 1, 'Initialisation du téléchargement...');
      const format = formatSelect.value;

      const result = await window.ScraperCore.downloadChapterAsZip(serieSlug, capSlug, {
        format,
        zipInstance: window.JSZip,
        onProgress: (cur, tot, msg) => {
          setProgress(cur, tot, msg);
        }
      });

      setProgress(result.totalPages, result.totalPages, 'Téléchargement du fichier ZIP...');
      window.ScraperCore.triggerDownload(result.blob, result.filename);

      setTimeout(() => {
        setProgress(result.totalPages, result.totalPages, 'Téléchargement terminé ! 🎉');
        btnDlActive.disabled = false;
        btnDlCustom.disabled = false;
      }, 1500);

    } catch (err) {
      console.error('Erreur:', err);
      setProgress(0, 0, `Erreur : ${err.message}`);
      btnDlActive.disabled = false;
      btnDlCustom.disabled = false;
    }
  }

  // 1. Détection de l'onglet actif
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.url) {
        const { serieSlug, capSlug } = window.ScraperCore.parseUrl(activeTab.url);
        if (serieSlug && capSlug) {
          activeSerie = serieSlug;
          activeCap = capSlug;
          tabInfoEl.innerHTML = `<strong>Série :</strong> ${serieSlug}<br><strong>Chapitre :</strong> ${capSlug}`;
          btnDlActive.style.display = 'flex';
        } else if (serieSlug) {
          tabInfoEl.innerHTML = `<strong>Série détectée :</strong> ${serieSlug}<br>Ouvrez un chapitre ou utilisez l'URL manuelle ci-dessous.`;
        } else {
          tabInfoEl.textContent = 'Aucun chapitre de NexusScan détecté sur cet onglet.';
        }
      } else {
        tabInfoEl.textContent = 'Entrez une URL de chapitre ci-dessous.';
      }
    });
  } else {
    tabInfoEl.textContent = 'Entrez une URL de chapitre ci-dessous.';
  }

  // 2. Événement clic sur bouton onglet actif
  btnDlActive.addEventListener('click', () => {
    if (activeSerie && activeCap) {
      executeDownload(activeSerie, activeCap);
    }
  });

  // 3. Événement clic sur bouton URL personnalisée
  btnDlCustom.addEventListener('click', () => {
    const rawUrl = customUrlInput.value.trim();
    if (!rawUrl) {
      alert('Veuillez entrer une URL de chapitre valide.');
      return;
    }

    const { serieSlug, capSlug } = window.ScraperCore.parseUrl(rawUrl);
    if (!serieSlug || !capSlug) {
      alert('Format d\'URL non reconnu. Exemple attendu :\nhttps://nexusscanlation.com/en/comics/bien-hecho-sucubo/chapter/capitulo-1');
      return;
    }

    executeDownload(serieSlug, capSlug);
  });
});
