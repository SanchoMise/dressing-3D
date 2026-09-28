# Habillage dressing 3D

Vue 3D interactive de l'habillage d'un dressing IKEA PAX (2 caissons de 75 cm,
4 portes battantes jusqu'au plafond, cadres d'alcôve en arche, poignées en
bois massif). Modèle construit d'après `Dressing_portes_plans_et_debit.pdf`
(à la racine du dépôt) — c'est la référence pour toute cote.

Site statique : aucune étape de build.

- Test local : `npx serve .` (ou ouvrir `index.html`)
- Vercel : `vercel` dans ce dossier, ou import du dépôt avec le preset
  « Other » (dossier racine = ce dossier, pas de commande de build).

## Fichiers

- `index.html` — structure de la page (scène 3D + panneau de réglages)
- `style.css` — mise en page et thème clair/sombre
- `app.js` — scène three.js, interactions, cinématique des portes
- `vendor/` — three.js r128 et OrbitControls (licence MIT), cache HTTP long
  (1 an, immutable) via `vercel.json`
- `vercel.json` — `cleanUrls` + en-têtes de cache

## Points notables du modèle

- **Rendu à la demande** : la scène ne se redessine que si quelque chose
  bouge (caméra, animation, survol). `requestAnimationFrame` est coupé quand
  l'onglet passe en arrière-plan (`visibilitychange`).
- **Qualité adaptative** : réglage Bas / Auto / Haut dans le panneau. En
  Auto, la résolution (pixel ratio) baisse automatiquement si le rendu
  devient lent, et ne remonte pas toute seule (évite les oscillations).
- **Cinématique des charnières** : chaque porte pivote autour de l'axe réel
  de sa charnière à cuvette Ø35 (décalé de 22 mm du chant, cf. plan p.2),
  pas autour du bord du panneau. Les butées d'ouverture (mur, portes
  voisines, poignées) sont calculées par un test de collision 2D (SAT) vu de
  dessus, au chargement.
- **Ouverture des portes** : le bouton/curseur globaux ouvrent les 4 portes
  en même temps (chacune jusqu'à sa propre butée) ; cliquer directement sur
  une porte dans la scène l'ouvre/la ferme individuellement.
- **Mobile** : sous 860px, le panneau de réglages est masqué par défaut et
  s'ouvre via le bouton « Réglages » flottant au-dessus de la scène.

## Ce qui reste ouvert

- La distance axe de cuvette / chant (22 mm) est une estimation médiane
  (plage documentée 21,5–23 mm selon le modèle de charnière, non fixé sur le
  plan). À ajuster si le modèle exact de charnière est connu.
- Pas de fusion de géométries / instanciation des charnières : la scène est
  petite (43 meshes) et le gain mesuré serait marginal par rapport au
  poids réseau, qui est le vrai goulot d'étranglement identifié.
