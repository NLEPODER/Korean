# 복습 · Révision coréen (Sejong)

PWA (application web installable, hors-ligne) pour réviser le vocabulaire et la
grammaire de la méthode **Sejong Korean**. Flashcards à répétition espacée (SM-2),
quiz, texte à trous, et parcours du vocabulaire — interface en français.

➡️ **En ligne :** https://nlepoder.github.io/Korean/

## Comment ça marche

L'app charge automatiquement tous les manuels présents dans le dossier
[`manuals/`](manuals/). Au démarrage elle lit `manuals/manifest.json` (la liste des
manuels disponibles) et importe chaque volume. Le bouton **« Rafraîchir »** relance
cette synchronisation à la demande. La progression d'apprentissage est conservée
localement (`localStorage`) et survit aux rafraîchissements.

## Ajouter ou mettre à jour un manuel

1. Dépose un fichier `sejong_korean_XX_data.json` dans [`manuals/`](manuals/)
   (format décrit dans [`guide_extraction_sejong.md`](guide_extraction_sejong.md)).
2. Commit + push sur `main`.

C'est tout. La **GitHub Action** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
régénère `manuals/manifest.json` automatiquement et redéploie le site. Le nouveau
manuel apparaît dans l'app au prochain « Rafraîchir » (ou rechargement).

> Le manifeste committé peut être régénéré en local avec `npm run manifest`.
> Ce n'est pas obligatoire : l'Action le recalcule à chaque déploiement.

## Structure

```
index.html              App complète (HTML + CSS + JS, autonome)
manifest.json           Manifeste PWA (icône, nom, couleurs)
sw.js                   Service worker (offline ; manuels en network-first)
icon-192.png / 512.png  Icônes
manuals/
  *_data.json           Un fichier de données par volume (1A, 1B, 2A…)
  manifest.json         Liste générée des manuels (auto, ne pas éditer à la main)
scripts/
  build-manifest.mjs    Génère manuals/manifest.json
guide_extraction_sejong.md   Méthode d'extraction manuel → JSON
```

## Développement local

```bash
npm run dev        # génère le manifeste puis sert le dossier sur http://localhost:3000
```

Un simple serveur statique suffit (l'app a besoin de `http(s)://`, pas de `file://`,
pour le `fetch` des manuels et le service worker).

## Déploiement

Hébergé sur **GitHub Pages**, source « GitHub Actions ». Chaque push sur `main`
déclenche le workflow qui régénère le manifeste et publie le site.
