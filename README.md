# Coupe du Monde 2026 — Bracket circulaire en direct

Visualisation circulaire du tableau à élimination directe de la Coupe du Monde 2026,
mise à jour en temps réel. Reproduction de la célèbre infographie SportBible (drapeaux
en couronne, lignes convergeant vers le trophée central), branchée sur des données live.

**Live :** https://ludovicp.github.io/world-cup/

## Fonctionnalités

- **Bracket circulaire en SVG** : 32 équipes en couronne → 16es → 8es → quarts → demis → finale, trophée doré au centre.
- **Temps réel** : polling toutes les 30 s ; gagnants propagés vers l'intérieur (score, puis tirs au but en cas d'égalité), scores et minute en direct.
- **Détail au clic** : équipes, score, buteurs (avec drapeau), tirs au but, stade et date.
- **Bilingue FR / EN**.

## Stack

100 % statique — HTML / CSS / JavaScript vanilla + SVG. **Aucune dépendance, aucun build.**

```
index.html        # shell
css/styles.css    # thème sombre, géométrie
main.js           # orchestration
js/api.js         # fetch + normalisation des données
js/bracket.js     # arbre + géométrie polaire
js/render.js      # rendu SVG
js/live.js        # polling
js/interact.js    # popover détail
js/i18n.js        # FR / EN
```

## Lancer en local

Doit être *servi* via HTTP (les modules ES et `fetch` exigent une origine http, pas `file://`) :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Données

API ouverte [`rezarahiminia/worldcup2026`](https://github.com/rezarahiminia/worldcup2026)
(hébergée sur `worldcup26.ir`). Drapeaux : [flagcdn.com](https://flagcdn.com).
