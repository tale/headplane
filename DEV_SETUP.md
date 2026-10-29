# Headscale et Headplane natifs — environnement de développement

Installation du 29 octobre 2026 sur `B550-GAMING-X-V2`. Guest Access n'est pas développé.

## Architecture installée

```text
Navigateur LAN ── HTTPS 192.168.0.120:3000/admin ── headplane.service
                                                    │ API privée
                                                    ▼
                                               127.0.0.1:8085
                                               headscale.service

Développement ── HTTP 127.0.0.1:3005/admin ── headplane-dev.service
                                                    │ même Headscale de développement
                                                    └─ base Headplane et sessions distinctes
```

L'option A a été approuvée : bases et identités neuves. L'ancien conteneur
`headscale-dev` et le volume `headscale-dev-data` existent toujours. Leurs seuls
services Supervisor Headscale et Headplane ont été arrêtés. Aucune identité,
clé ou base de l'ancien environnement n'a été importée.

Le port 3000 est libre sur l'hôte. Les mentions Docker `3000/tcp` de BugHunter
et HuntTheThreat sont des ports internes, sans publication sur ce port de
l'hôte. Le port 3003 était le repli autorisé ; il n'a pas été nécessaire.
`8080` reste réservé à l'ancien conteneur et `8089` à BugHunter.

## Versions et sources

| Composant          | Version effectivement utilisée                                                               |
| ------------------ | -------------------------------------------------------------------------------------------- |
| OS                 | Ubuntu 24.04.5 LTS, amd64, noyau 7.0.0-38-generic                                            |
| Headscale          | Release officielle 0.29.6 ; le binaire affiche `v0.29.6+dirty`                               |
| Headplane          | package 0.8.1, commit `c8c192dbf0ade31f5947777fa4f46e45885edb49`, correctif local de session |
| Node.js            | 24.22.2                                                                                      |
| pnpm               | 10.4.0                                                                                       |
| Go                 | 1.27.2 ; go.mod demande au minimum 1.27.1                                                    |
| Git / Python / GCC | 2.43.0 / 3.12.3 / 13.3.0                                                                     |

Les archives officielles Headscale et Node ont été comparées à leurs manifestes
SHA-256. Go a été vérifié avec l'empreinte publiée par `go.dev/dl`.
Les résultats sont dans `../headplane-native-setup/artifacts/verified-sha256.json`.

Les outils isolés sont dans `/opt/headplane/toolchains/`. Le Node nvm et le Go
globaux préexistants n'ont pas été remplacés. Les outils Git, curl, wget,
ca-certificates, build-essential, Python, OpenSSL, patch, libssl-dev et pkg-config
étaient déjà présents. SQLite est administré avec son API Python ; le CLI sqlite3
n'est pas nécessaire à cette installation.

```bash
cd /home/brokcat/dev/headplane
source ../headplane-native-setup/env.sh
node --version
pnpm --version
go version
git remote -v
git status --short --branch
```

`origin` pointe vers `https://github.com/broxcat/headplane.git`, `upstream` vers
`https://github.com/tale/headplane.git`, branche `feature/guest-access`.
Aucun commit ni push n'a été effectué.

## Interface et authentification

Interface stable : **https://192.168.0.120:3000/admin**.

Certificat public de l'autorité locale :
`/home/brokcat/dev/headplane-native-setup/headplane-local-ca.crt`.
Importer ce certificat comme autorité de confiance sur les appareils qui
administrent Headplane. Ne jamais distribuer `/var/lib/headplane-ca/ca.key`.
Aucun magasin global de confiance de l'hôte n'a été modifié.

La connexion utilise une clé API Headscale, pas un mot de passe local inventé.
La nouvelle clé administrateur est conservée dans
`/etc/headplane/secrets/admin-api-key`, root uniquement. La consulter localement
avec un éditeur sécurisé ou un gestionnaire de secrets disposant des droits
nécessaires. Ne pas la copier dans un ticket, un journal, Git ou cette documentation.
Sa durée initiale est 30 jours. La clé serveur distincte et la clé de développement
durent 90 jours. Leur rotation est décrite dans `HEADSCALE_OPERATIONS.md`.

La session de l'interface HTTPS dure au maximum 8 heures, avec cookie
`Secure`, `HttpOnly`, `SameSite=Lax`. La clé API et le secret de signature sont
lus depuis des fichiers privés. Aucun proxy d'identité n'est déclaré de confiance.

Un correctif local de sécurité a été nécessaire : le fork n'émettait pas
`HttpOnly` et les sessions API pouvaient dépasser `server.cookie_max_age`.
Le correctif concerne `app/server/web/auth.ts`, ajoute trois tests de régression
et une entrée au changelog. Il ne développe pas Guest Access. La release installée
contient `source.patch`, `release.json` et `SHA256.json` pour tracer ces changements.
Les cookies émis avant ce correctif ont été invalidés par rotation du secret.

## Développement et hot reload

```bash
sudo systemctl start headplane-dev
curl --noproxy '*' http://127.0.0.1:3005/admin/healthz
sudo journalctl -fu headplane-dev
sudo systemctl stop headplane-dev
```

Ce service reste désactivé au démarrage et n'écoute que sur la boucle locale.
Son URL est `http://127.0.0.1:3005/admin`. Depuis un autre appareil, utiliser
un tunnel SSH local si nécessaire :

```bash
ssh -N -L 3005:127.0.0.1:3005 brokcat@192.168.0.120
```

Configuration : `~/.config/headplane-dev/config.yaml`, données :
`~/.local/share/headplane-dev/`. La clé de développement est privée dans
`~/.config/headplane-dev/api-key`. Le cookie de développement n'a pas `Secure`
car le service utilise HTTP sur la boucle locale ; il conserve `HttpOnly`.
Sa durée maximale est 1 heure. L'agent y est désactivé pour ne pas partager
l'identité ou les fichiers d'état du service stable.

Les deux interfaces administrent le même **Headscale de développement natif** :
une modification d'utilisateur, de machine ou d'ACL depuis l'une est visible
dans l'autre. Leurs bases Headplane et leurs secrets de session sont distincts.
La copie `~/.config/headplane-dev/headscale-view.yaml` est uniquement une vue de
configuration, sans droit d'écriture sur `/etc/headscale/config.yaml`.

Ne pas lancer `pnpm dev` ici : ce script lance aussi le Compose de développement.
Pour travailler sans systemd, arrêter d'abord `headplane-dev`, puis lancer :

```bash
source /home/brokcat/dev/headplane-native-setup/env.sh
HEADPLANE_CONFIG_PATH=/home/brokcat/.config/headplane-dev/config.yaml \
  pnpm exec react-router dev --host 127.0.0.1 --port 3005 --strictPort
```

## Compiler, tester et installer une release

```bash
cd /home/brokcat/dev/headplane
source ../headplane-native-setup/env.sh
pnpm install --frozen-lockfile
./build.sh --wasm --agent --healthcheck \
  --agent-output /home/brokcat/dev/headplane-native-setup/bin/hp_agent \
  --healthcheck-output /home/brokcat/dev/headplane-native-setup/bin/hp_healthcheck
pnpm test:unit
pnpm run typecheck
pnpm run lint
go test ./...
pnpm run build
```

Les binaires Go sont placés hors de `build/` : la compilation React Router
nettoie ce répertoire. Limiter la concurrence Go avec l'environnement fourni.
Le hot reload, les générateurs TypeScript et les builds utilisent le checkout ;
la release systemd sous `/opt/headplane/releases/` est indépendante.

Après vérification et sauvegarde, installer les nouveaux artefacts :

```bash
sudo systemctl start headplane-backup.service
sudo python3 /home/brokcat/dev/headplane-native-setup/deploy-release.py
sudo systemctl restart headplane
curl --noproxy '*' \
  --cacert /home/brokcat/dev/headplane-native-setup/headplane-local-ca.crt \
  https://192.168.0.120:3000/admin/healthz
```

`/opt/headplane/current` désigne la release active ; `/opt/headplane/previous`
désigne la précédente. Ne pas utiliser une ancienne release sans le correctif
de session pour une administration réelle.

## Validation effectuée

- 256 tests unitaires dans 20 fichiers réussis, dont 3 régressions de session.
- Typecheck réussi et lint avec code retour 0 ; avertissement préexistant
  `no-unused-vars` dans `app/utils/live-data.tsx`.
- Avertissements Vite préexistants sur les imports sans extension ; ils ne
  bloquent ni la compilation ni le hot reload. Le fork n'a pas de tag local,
  donc la détection de version utilise package.json.
- Build React Router, Go agent, Browser SSH WASM et healthcheck réussis.
- `go test ./...` réussi pour les paquets natifs concernés.
- Authentification valide et refus d'une clé incorrecte, protection des pages,
  attributs et durée du cookie vérifiés en HTTP réel et dans un navigateur.
- Création/suppression d'un utilisateur temporaire, création/expiration d'une
  clé d'inscription et lecture/écriture/restauration d'ACL via Headplane.
- Agent inscrit avec une nouvelle identité, en ligne ; synchronisation déclenchée
  depuis le navigateur et terminée. API d'approbation de routes testée avec une
  liste vide : aucune route activée.
- Redémarrages systemd de Headscale et Headplane ; utilisateur `brokcat`, ACL,
  identité de l'agent et session conservés. Intégrité des deux SQLite vérifiée.
- WebSocket HMR connecté, modification temporaire d'une source détectée, source
  restaurée et page opérationnelle ensuite.
- Sauvegarde native exécutée, extraite et vérifiée par empreintes et SQLite.
- Identité Tailscale officielle et IP conservées ; aucun conteneur existant
  redémarré depuis le relevé initial ; règles iptables IPv4/IPv6 inchangées
  hors compteurs de paquets.

Les résultats détaillés sans secrets sont dans `../headplane-native-setup/` :
`functional-results.json`, `browser-results.json`, `production-browser-results.json`,
`preservation-results.json` et les journaux des compilations et tests.
`verify-native.py` crée puis retire des données de test et redémarre les deux
services natifs : ce n'est pas une simple sonde de santé.

L'accès depuis **un second appareil du LAN** reste à confirmer par l'utilisateur :

```bash
scp brokcat@192.168.0.120:/home/brokcat/dev/headplane-native-setup/headplane-local-ca.crt .
curl --cacert headplane-local-ca.crt --connect-timeout 5 \
  https://192.168.0.120:3000/admin/healthz
```

Résultat attendu : `{"status":"OK"}`. L'enrôlement d'un client externe, Browser
SSH de bout en bout et le routage réel de sous-réseaux ne sont pas déclarés testés.
Ils ne sont pas activés dans cette phase privée.

## Suite Guest Access

Après confirmation LAN : examiner les rôles, sessions, inscriptions et politiques
existants ; définir les droits et le cycle de vie d'un invité ; écrire les tests
de permission appropriés ; implémenter ensuite sur `feature/guest-access`.
Conserver le correctif de session séparément identifiable et le faire relire.
Ne pas connecter les clients de production pendant ce développement.

Voir `HEADSCALE_OPERATIONS.md` pour l'exploitation et le retour arrière,
et `TAILSCALE_MIGRATION_PLAN.md` avant toute bascule de client.
