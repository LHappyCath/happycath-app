# L'HappyCath Academy — Application de gestion

## Guide d'installation complet

---

## Étape 1 — Configurer Supabase

1. Va sur **https://ukpvsxubussqapxoyqyg.supabase.co**
2. Clique sur **SQL Editor** dans le menu gauche
3. Clique sur **New query**
4. Copie-colle tout le contenu du fichier `supabase-schema.sql`
5. Clique **Run** — toutes les tables sont créées
6. Va dans **Settings > API**
7. Copie la clé **anon public** (commence par `eyJ...`)
   → Tu en auras besoin à l'étape 3

---

## Étape 2 — Créer le dépôt GitHub

1. Va sur **github.com** → connecte-toi avec le compte LHappyCath
2. Clique **New repository** (bouton vert)
3. Nom du dépôt : `happycath-app`
4. Visibilité : **Public** (nécessaire pour GitHub Pages gratuit)
5. Clique **Create repository**

---

## Étape 3 — Ajouter les secrets GitHub

Dans ton dépôt GitHub → **Settings > Secrets and variables > Actions > New repository secret**

Ajoute ces 2 secrets :

| Nom | Valeur |
|-----|--------|
| `SUPABASE_URL` | `https://ukpvsxubussqapxoyqyg.supabase.co` |
| `SUPABASE_ANON_KEY` | La clé anon copiée à l'étape 1 |

---

## Étape 4 — Uploader les fichiers

### Option A — Via l'interface GitHub (plus simple)
1. Dans ton dépôt, clique **uploading an existing file**
2. Glisse-dépose tous les fichiers du dossier `happycath-app`
3. Clique **Commit changes**

### Option B — Via Git (si tu as Git installé)
```bash
cd happycath-app
git init
git remote add origin https://github.com/LHappyCath/happycath-app.git
git add .
git commit -m "Premier déploiement HappyCath"
git push -u origin main
```

---

## Étape 5 — Activer GitHub Pages

1. Dans ton dépôt → **Settings > Pages**
2. Source : **GitHub Actions**
3. Sauvegarde

Le déploiement se lance automatiquement (2-3 minutes).

---

## Étape 6 — Accéder à l'app

URL de l'application : **https://lhappycath.github.io/happycath-app**

### Installer sur iPhone
1. Ouvre l'URL dans **Safari**
2. Appuie sur l'icône **Partager** (carré avec flèche)
3. Sélectionne **Sur l'écran d'accueil**
4. L'app s'installe comme une vraie application !

---

## Mises à jour

Pour mettre à jour l'app, il suffit de pousser les nouveaux fichiers sur GitHub.
Le déploiement est automatique en 2-3 minutes.

---

## Support

Projet développé avec Claude (Anthropic).
