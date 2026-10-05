/**
 * ScraperCore - Moteur de scraping et déchiffrement pour NexusScanlation
 * 
 * Responsabilités :
 * 1. Communication avec l'API officielle (api.nexusscanlation.com/api/v1)
 * 2. Négociation de clé ECDH (P-256) pour l'en-tête X-Rs
 * 3. Dérivation HKDF-SHA256 et déchiffrement AES-GCM du payload 'r' (graines de mélange et clés)
 * 4. Reconstitution (descramble) des tuiles d'images mélangées via Canvas 2D et PRNG Mulberry32
 * 5. Déchiffrement optionnel des flux chiffrés RFC8188 (aes128gcm)
 */

(function (global) {
  'use strict';

  const API_BASE = 'https://api.nexusscanlation.com/api/v1';

  /**
   * Utilitaires Base64 / Base64URL
   */
  function base64UrlEncode(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function base64UrlDecode(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(4 * Math.ceil(str.length / 4), '=');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Générateur pseudo-aléatoire Mulberry32 (utilisé par le lecteur pour mélanger les tuiles)
   */
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      let t = Math.imul((seed = seed + 0x6d2b79f5 | 0) ^ (seed >>> 15), 1 | seed);
      return (((t = (t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t)) ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
  }

  const ScraperCore = {
    /**
     * Parse une URL de NexusScanlation pour en extraire le serieSlug et le capSlug
     * Formats supportés :
     * - /en/comics/bien-hecho-sucubo/chapter/capitulo-1
     * - /series/bien-hecho-sucubo/chapter/capitulo-1
     * - /comics/bien-hecho-sucubo
     */
    parseUrl(urlStr) {
      try {
        const base = (typeof window !== 'undefined' && window.location) ? window.location.href : 'https://nexusscanlation.com';
        const url = new URL(urlStr, base);
        const parts = url.pathname.split('/').filter(Boolean);
        
        let serieSlug = null;
        let capSlug = null;

        for (let i = 0; i < parts.length; i++) {
          const seg = parts[i];
          if (seg === 'comics' || seg === 'series' || seg === 'manhua' || seg === 'sakuhin') {
            if (parts[i + 1]) serieSlug = parts[i + 1];
          }
          if (seg === 'chapter' || seg === 'capitulo') {
            if (parts[i + 1]) capSlug = parts[i + 1];
          }
        }

        return { serieSlug, capSlug };
      } catch (err) {
        console.error('Erreur lors du parsing de l\'URL:', err);
        return { serieSlug: null, capSlug: null };
      }
    },

    /**
     * Récupère les métadonnées d'une série (titre, synopsis, liste des chapitres)
     */
    async getSeriesInfo(serieSlug) {
      const res = await fetch(`${API_BASE}/series/${serieSlug}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      if (!res.ok) {
        throw new Error(`Impossible de récupérer la série ${serieSlug} (HTTP ${res.status})`);
      }
      return await res.json();
    },

    /**
     * Négocie la clé ECDH et récupère les données déchiffrées du chapitre
     */
    async getChapterData(serieSlug, capSlug) {
      const subtle = (global.crypto || window.crypto).subtle;

      // 1. Génération de la paire de clés éphémère ECDH P-256
      const clientKeyPair = await subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
      );

      // 2. Export de la clé publique au format brut (65 octets non compressés)
      const clientPubRaw = new Uint8Array(await subtle.exportKey('raw', clientKeyPair.publicKey));
      const xRsHeader = base64UrlEncode(clientPubRaw);

      // 3. Appel de l'API avec l'en-tête X-Rs
      const apiUrl = `${API_BASE}/series/${serieSlug}/capitulos/${capSlug}`;
      const res = await fetch(apiUrl, {
        headers: {
          'X-Rs': xRsHeader,
          'Origin': 'https://nexusscanlation.com',
          'Referer': `https://nexusscanlation.com/comics/${serieSlug}/chapter/${capSlug}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36'
        }
      });

      if (!res.ok) {
        let msg = `Erreur API (HTTP ${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson.message) msg += `: ${errJson.message}`;
        } catch (_) {}
        throw new Error(msg);
      }

      const json = await res.json();
      const chapter = json.data;

      // 4. Déchiffrement du champ 'r' si présent (contient les graines des tuiles et clés de déchiffrement)
      let seedsMap = {};
      let keysMap = {};

      if (chapter.r) {
        const wrapped = base64UrlDecode(chapter.r);
        if (wrapped.length < 93) {
          throw new Error('Payload r invalide (taille trop courte)');
        }

        // Le serveur envoie sa clé publique ECDH dans les 65 premiers octets
        const serverPubRaw = wrapped.slice(0, 65);
        const serverPubKey = await subtle.importKey(
          'raw',
          serverPubRaw,
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          []
        );

        // Dérivation du secret partagé ECDH (256 bits)
        const sharedBits = await subtle.deriveBits(
          { name: 'ECDH', public: serverPubKey },
          clientKeyPair.privateKey,
          256
        );

        // Dérivation de la clé AES-GCM via HKDF
        const hkdfKey = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
        const aesKey = await subtle.deriveKey(
          {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(0),
            info: new TextEncoder().encode('nexus:lector:v1')
          },
          hkdfKey,
          { name: 'AES-GCM', length: 128 },
          false,
          ['decrypt']
        );

        // Déchiffrement AES-GCM (IV 12 octets à l'offset 65, puis ciphertext)
        const iv = wrapped.slice(65, 77);
        const ciphertext = wrapped.slice(77);
        const decryptedPlain = await subtle.decrypt(
          { name: 'AES-GCM', iv },
          aesKey,
          ciphertext
        );

        const decodedInfo = JSON.parse(new TextDecoder().decode(decryptedPlain));
        seedsMap = decodedInfo.s || {};
        keysMap = decodedInfo.k || {};
      }

      // Associer à chaque page sa graine de reconstitution et sa clé de déchiffrement
      const pages = (chapter.paginas || []).map(p => {
        const orderStr = String(p.orden);
        const pageCopy = { ...p };
        if (pageCopy.sc) {
          pageCopy.sc = {
            ...pageCopy.sc,
            s: seedsMap[orderStr] ?? 0
          };
        }
        if (pageCopy.e && keysMap[orderStr]) {
          pageCopy.key = keysMap[orderStr];
        }
        return pageCopy;
      });

      return {
        ...chapter,
        paginas: pages
      };
    },

    /**
     * Déchiffre un flux binaire RFC8188 (aes128gcm) si la page est protégée par chiffrement intégral
     */
    async decryptRfc8188(hkdfKeyRaw, arrayBuffer) {
      const subtle = (global.crypto || window.crypto).subtle;
      const data = new Uint8Array(arrayBuffer);
      if (data.length < 21) throw new Error('RFC8188: taille de données insuffisante');

      const salt = data.subarray(0, 16);
      const recordSize = new DataView(arrayBuffer).getUint32(16);
      const headerLength = 21 + data[20];
      if (recordSize < 18 || data.length < headerLength) throw new Error('RFC8188: en-tête invalide');

      const keyRaw = typeof hkdfKeyRaw === 'string' ? base64UrlDecode(hkdfKeyRaw) : hkdfKeyRaw;
      const baseKey = await subtle.importKey('raw', keyRaw, 'HKDF', false, ['deriveBits', 'deriveKey']);

      const infoKey = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
      const infoNonce = new TextEncoder().encode('Content-Encoding: nonce\0');

      const [aesKey, nonce] = await Promise.all([
        subtle.deriveKey(
          { name: 'HKDF', hash: 'SHA-256', salt, info: infoKey },
          baseKey,
          { name: 'AES-GCM', length: 128 },
          false,
          ['decrypt']
        ),
        subtle.deriveBits(
          { name: 'HKDF', hash: 'SHA-256', salt, info: infoNonce },
          baseKey,
          96
        ).then(buf => new Uint8Array(buf))
      ]);

      const records = [];
      for (let offset = headerLength, seq = 0; offset < data.length; offset += recordSize, seq++) {
        const iv = nonce.slice();
        const dv = new DataView(iv.buffer);
        dv.setUint32(8, dv.getUint32(8) ^ (seq >>> 0));
        const chunk = data.subarray(offset, Math.min(offset + recordSize, data.length));
        records.push(subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, chunk));
      }

      const decryptedChunks = (await Promise.all(records)).map(b => new Uint8Array(b));
      let totalLen = 0;
      const trimmedChunks = decryptedChunks.map((chunk, idx) => {
        let end = chunk.length - 1;
        while (end >= 0 && chunk[end] === 0) end--;
        const isLast = (idx === decryptedChunks.length - 1);
        if (end < 0 || chunk[end] !== (isLast ? 2 : 1)) throw new Error('RFC8188: délimiteur invalide');
        totalLen += end;
        return chunk.subarray(0, end);
      });

      const result = new Uint8Array(totalLen);
      let pos = 0;
      for (const ch of trimmedChunks) {
        result.set(ch, pos);
        pos += ch.length;
      }
      return result;
    },

    /**
     * Télécharge une image, la déchiffre / réassemble si nécessaire, et renvoie un Blob
     */
    async downloadAndProcessPage(page, options = {}) {
      const format = options.format || 'image/jpeg';
      const quality = options.quality ?? 0.95;

      // 1. Récupération des données brutes
      const res = await fetch(page.url, {
        headers: {
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });
      if (!res.ok) {
        throw new Error(`Échec du téléchargement de la page ${page.orden} (HTTP ${res.status})`);
      }

      let imgData = await res.arrayBuffer();

      // Si la page utilise le chiffrement RFC8188
      if (page.e && page.key) {
        imgData = await this.decryptRfc8188(page.key, imgData);
      }

      // Si la page n'est pas mélangée (pas de champ 'sc'), renvoyer le blob directement
      if (!page.sc) {
        return new Blob([imgData], { type: format });
      }

      // 2. Reconstitution de l'image mélangée (Scrambled)
      const blob = new Blob([imgData]);
      const imgBitmap = await createImageBitmap(blob);

      const cols = page.sc.c;
      const rows = page.sc.r;
      const seed = page.sc.s;
      const version = page.sc.v ?? 1;
      const totalTiles = cols * rows;

      const imgW = imgBitmap.width;
      const imgH = imgBitmap.height;
      const tileW = Math.floor(imgW / cols);
      const tileH = Math.floor(imgH / rows);

      // Création du canvas aux dimensions exactes
      const canvas = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(tileW * cols, tileH * rows)
        : document.createElement('canvas');

      canvas.width = tileW * cols;
      canvas.height = tileH * rows;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Impossible d\'obtenir le contexte Canvas 2D');

      // Génération de la permutation et des inversions
      const rng = mulberry32(seed >>> 0);
      const perm = Array.from({ length: totalTiles }, (_, i) => i);
      for (let t = totalTiles - 1; t > 0; t--) {
        const j = Math.floor(rng() * (t + 1));
        const temp = perm[t];
        perm[t] = perm[j];
        perm[j] = temp;
      }

      const flips = version >= 2 ? Array(totalTiles) : null;
      if (flips) {
        for (let t = 0; t < totalTiles; t++) {
          flips[t] = Math.floor(4 * rng());
        }
      }

      // Dessin des tuiles réordonnées
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

      // Libération des ressources bitmap
      if (imgBitmap.close) imgBitmap.close();

      // 3. Conversion du Canvas en Blob
      if (canvas.convertToBlob) {
        return await canvas.convertToBlob({ type: format, quality });
      } else {
        return new Promise((resolve) => {
          canvas.toBlob(resolve, format, quality);
        });
      }
    },

    /**
     * Déclenche le téléchargement d'un Blob dans le navigateur
     */
    triggerDownload(blob, filename) {
      if (typeof window === 'undefined' || !document?.createElement) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },

    /**
     * Télécharge un chapitre complet et génère une archive .ZIP prête à l'emploi
     * @param {string} serieSlug
     * @param {string} capSlug
     * @param {Object} options { onProgress: (done, total, message) => {}, format: 'image/jpeg', quality: 0.95, zipInstance: JSZip }
     */
    async downloadChapterAsZip(serieSlug, capSlug, options = {}) {
      const onProgress = options.onProgress || (() => {});
      const JSZipLib = options.zipInstance || (typeof JSZip !== 'undefined' ? JSZip : null);

      if (!JSZipLib) {
        throw new Error('JSZip est requis pour générer le fichier zip.');
      }

      onProgress(0, 1, 'Récupération des métadonnées du chapitre...');
      const chapter = await this.getChapterData(serieSlug, capSlug);
      const pages = chapter.paginas || [];
      const totalPages = pages.length;

      if (totalPages === 0) {
        throw new Error('Aucune page trouvée dans ce chapitre.');
      }

      // Formatage du nom de fichier ZIP
      const chapNum = chapter.numero !== undefined ? chapter.numero : capSlug;
      const zipFileName = `[NexusScan] ${serieSlug} - Ch.${chapNum}.zip`;

      const zip = new JSZipLib();
      const folder = zip.folder(`Ch.${chapNum}`) || zip;

      onProgress(0, totalPages, `0 / ${totalPages} pages traitées...`);

      // Téléchargement par lots (concurrence de 3 pages)
      const concurrency = 3;
      let completedCount = 0;

      for (let i = 0; i < pages.length; i += concurrency) {
        const batch = pages.slice(i, i + concurrency);
        await Promise.all(batch.map(async (page) => {
          const pageBlob = await this.downloadAndProcessPage(page, {
            format: options.format || 'image/jpeg',
            quality: options.quality ?? 0.95
          });

          // Numérotation propre à 3 chiffres : 001.jpg, 002.jpg...
          const ext = options.format === 'image/png' ? 'png' : 'jpg';
          const fileIndex = String(page.orden).padStart(3, '0');
          const fileName = `${fileIndex}.${ext}`;

          folder.file(fileName, pageBlob);
          completedCount++;
          onProgress(completedCount, totalPages, `Page ${completedCount} / ${totalPages} traitée...`);
        }));
      }

      onProgress(totalPages, totalPages, 'Compression du fichier ZIP en cours...');
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE', // Rapide car les JPEG/PNG sont déjà compressés
      });

      return {
        blob: zipBlob,
        filename: zipFileName,
        totalPages,
        chapter
      };
    }
  };

  // Export pour environnement navigateur / module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScraperCore;
  } else {
    global.ScraperCore = ScraperCore;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

