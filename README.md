# notes-app — Pipeline CI/CD

## Processus de release

Ce projet suit un workflow de versionnement et de release strict afin de garantir la traçabilité et la reproductibilité.

---

### Intégration continue (push sur `main`)

Chaque push sur `main` déclenche le workflow `ci-main.yml`, qui :

1. Installe les dépendances (`npm ci`)
2. Exécute les tests (`npm test` via Vitest)
3. Si les tests passent, construit et pousse une image Docker sur Docker Hub avec deux tags :
   - `latest` — pointe toujours vers le dernier build sur `main`
   - `<sha>` — le SHA du commit Git pour la traçabilité

> Si les tests échouent, le build et le push Docker sont ignorés.

---

### PR gate (pull request vers `main`)

Chaque pull request ciblant `main` déclenche `pr-ci.yml`, qui :

1. Installe les dépendances
2. Exécute la suite de tests complète

La PR ne peut pas être mergée tant que cette vérification n'est pas passée. Cela impose une quality gate avant que du code atteigne `main`.

---

### Créer une release (version produit)

Pour publier une release versionnée, créer et pousser un tag Git :

```bash
git tag v1.0.0
git push origin v1.0.0
```

Cela déclenche `release.yml`, qui construit et pousse une image Docker taguée avec la version (ex: `v1.0.0`) sur Docker Hub.

> Aucune modification de code n'est nécessaire — le tag seul suffit à déclencher le workflow.

---

### Règles de versionnement

Ce projet suit le [Semantic Versioning](https://semver.org/) :

- `vMAJEUR.MINEUR.PATCH` — ex: `v1.2.3`
- Un tag de version **ne doit jamais être reconstruit** — une fois publié, il est immuable
- `latest` est un tag flottant et ne représente **pas** une version fixe

---

### Traçabilité

| Artefact | Traçabilité |
|---|---|
| Tag Docker `latest` | Pointe vers le dernier build sur `main` — non fixe |
| Tag Docker `<sha>` | Lié à un commit Git exact |
| Tag Docker `vX.Y.Z` | Lié à un tag Git exact — immuable |

Chaque image construite depuis `main` est traçable jusqu'à un commit précis via son tag SHA. Les images de release sont traçables jusqu'à un tag Git précis.

---

## Questions et réponses

**Pourquoi `latest` n'est pas une version ?**
`latest` est un tag flottant réécrit à chaque build. Il ne garantit ni l'immuabilité ni la reproductibilité — déployer `latest` aujourd'hui et dans trois semaines peut donner deux images différentes sans que ce soit visible.

**Différence entre tag et digest ?**
Un tag (ex: `v1.0.0`, `latest`) est un alias lisible qui peut pointer vers des images différentes dans le temps. Un digest (ex: `sha256:abc123...`) est un hash immuable du contenu exact de l'image — il ne change jamais.

**Pourquoi séparer staging et prod ?**
Pour éviter de déployer directement en production du code non validé. Le staging permet de tester dans un environnement proche de la prod sans risquer d'impacter les utilisateurs réels.

**Pourquoi une version `vX.Y.Z` ne doit jamais être reconstruite ?**
Reconstruire une image avec le même tag peut produire un binaire différent (nouvelles dépendances, image de base mise à jour...), ce qui casse la reproductibilité et la traçabilité. Une version doit correspondre à un artefact immuable.

**Avantages d'une PR gate ?**
- Empêche de merger du code qui casse les tests
- Force une revue avant intégration sur `main`
- Documente les changements via la PR
- Maintient la branche `main` dans un état stable

**Qu'est-ce qui garantit la traçabilité ici ?**
Chaque image Docker poussée depuis `main` reçoit un tag `<sha>` correspondant au commit Git exact. Les releases reçoivent un tag `vX.Y.Z` lié au tag Git. Il est donc possible de retrouver à tout moment quel commit correspond à quelle image.

---

## Problèmes rencontrés

### Job `default` invalide dans le workflow

Un job avait été écrit avec `run` comme propriété directe :

```yaml
jobs:
  default:
    run:
      working-directory: notes-app/api  # invalide
```

`run` est une propriété d'un **step**, pas d'un job. La bonne façon de définir un répertoire de travail par défaut pour un job est :

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: notes-app/api  # correct
```

### Erreur de contexte Docker Build (`package-lock.json` not found)

L'action `docker/build-push-action` était configurée avec `context: notes-app`, mais le Dockerfile faisait :

```dockerfile
COPY package.json package-lock.json ./
```

Docker cherchait ces fichiers à la racine du contexte (`notes-app/`), alors qu'ils se trouvaient dans `notes-app/api/`. La solution : pointer le contexte directement sur le dossier contenant le Dockerfile :

```yaml
- name: Build & Push versioned image
  uses: docker/build-push-action@v6
  with:
    context: notes-app/api
    file: notes-app/api/Dockerfile
```

Ainsi le Dockerfile et les fichiers `package*.json` sont au même niveau dans le contexte de build.