# ⚡ Nexus Scraper - Téléchargeur de Manhwa

Extension Web & Userscript pour télécharger automatiquement les chapitres de **Nexus Scanlation** en archives `.ZIP` de haute qualité avec reconstitution et déchiffrement complets des images.

---

## 🚀 Fonctionnalités

- **Déchiffrement & Reconstitution Automatiques** :
  - Négociation de clé cryptographique éphémère **ECDH (P-256)** via l'en-tête `X-Rs`.
  - Dérivation de clé **HKDF-SHA256** et déchiffrement **AES-GCM**.
  - Reconstitution des tuiles mélangées (*scramble*) via le générateur pseudo-aléatoire **Mulberry32** et réorientation des axes (*flips* horizontaux/verticaux).
- **Téléchargement direct en archive ZIP** :
  - Crée une archive propre `[NexusScan] {Série} - Ch.{Numéro}.zip` contenant les images ordonnées (`001.jpg`, `002.jpg`, etc.).
  - Choix du format : **JPG (Qualité 95%)** ou **PNG (Sans perte)**.
- **Barre de progression en temps réel** intégrée à la page.
- **Deux méthodes d'utilisation prêtes à l'emploi** :
  1. **Extension Navigateur** (Chrome, Edge, Brave, Opera, Firefox).
  2. **Userscript Tampermonkey / Violentmonkey** (Installation en 1 clic).

---

## 📦 Option 1 : Installation comme Extension Web (Recommandé)

Fonctionne sur tous les navigateurs Chromium (**Google Chrome, Microsoft Edge, Brave, Opera**) et **Firefox**.

### Étapes d'installation (en 15 secondes) :

1. Ouvrez votre navigateur et allez sur la page des extensions :
   - **Chrome / Brave** : `chrome://extensions`
   - **Edge** : `edge://extensions`
2. Activez le **Mode développeur** (interrupteur en haut à droite).
3. Cliquez sur **"Charger l'extension non empaquetée"** (*Load unpacked*).
4. Sélectionnez le dossier :
   ```
   c:\Users\herrv\Documents\ScraperNexus\extension
   ```
5. C'est prêt ! L'extension est active.

---

## 🐒 Option 2 : Installation via Tampermonkey / Violentmonkey

Si vous utilisez déjà un gestionnaire de scripts utilisateurs :

1. Ouvrez le tableau de bord de **Tampermonkey** ou **Violentmonkey**.
2. Cliquez sur **"Créer un nouveau script"** (+).
3. Copiez l'intégralité du contenu du fichier :
   [`userscript/nexus-scraper.user.js`](file:///c:/Users/herrv/Documents/ScraperNexus/userscript/nexus-scraper.user.js)
4. Collez-le dans l'éditeur et faites **Fichier > Enregistrer** (`Ctrl + S`).

---

## 🎯 Comment l'utiliser

### 1. Sur la page d'un chapitre
Rendez-vous par exemple sur :
👉 `https://nexusscanlation.com/en/comics/bien-hecho-sucubo/chapter/capitulo-1`

- Un panneau flottant doré élégant apparaît en bas à droite : **[⚡ Nexus DL] [Format: JPG/PNG] [📥 Télécharger ZIP]**.
- Cliquez sur **"Télécharger ZIP"**.
- Une fenêtre de progression s'affiche pendant que les pages sont téléchargées, déchiffrées et assemblées.
- Le fichier ZIP se télécharge automatiquement dans votre dossier Téléchargements dès que c'est terminé.

### 2. Sur la page de présentation d'une série
Rendez-vous sur :
👉 `https://nexusscanlation.com/en/comics/bien-hecho-sucubo`

- Un bouton **📥 ZIP** est automatiquement ajouté à côté de chaque chapitre dans la liste.
- Vous pouvez cliquer directement sur le chapitre souhaité pour le télécharger sans même ouvrir le lecteur !

### 3. Depuis le popup de l'extension
- Cliquez sur l'icône de l'extension dans votre barre d'outils.
- Vous pouvez voir le chapitre actif ou coller manuellement n'importe quelle URL de chapitre pour lancer le téléchargement.

---

## 📁 Structure du Projet

```
ScraperNexus/
├── extension/                     # Extension Web complète (Manifest V3)
│   ├── manifest.json             # Configuration de l'extension
│   ├── content.js                # Injection dans la page et gestionnaire d'UI
│   ├── content.css               # Design system sombre et accents dorés
│   ├── popup.html                # Interface de l'icône d'extension
│   ├── popup.js                  # Logique du popup
│   ├── popup.css                 # Styles du popup
│   ├── icons/                    # Icônes 16x16, 48x48, 128x128
│   └── lib/
│       ├── jszip.min.js          # Bibliothèque de compression ZIP
│       └── scraper-core.js       # Moteur crypto & descramble réutilisable
├── userscript/
│   └── nexus-scraper.user.js     # Script Tampermonkey tout-en-un
└── README.md                      # Guide d'utilisation
```
