# Exploitation Headscale et Headplane natifs

État initial : 29 octobre 2026. Instance privée de développement, sans migration
des clients Tailscale existants. Voir `DEV_SETUP.md` pour les versions et tests.

## Services, comptes et fichiers

| Élément             | Valeur                                                              |
| ------------------- | ------------------------------------------------------------------- |
| Headscale           | `/usr/local/bin/headscale`, utilisateur système `headscale`         |
| Configuration       | `/etc/headscale/config.yaml`, root:`headscale-config`, 0640         |
| Données             | `/var/lib/headscale/`, `headscale:headscale`, répertoire 0700       |
| SQLite / Noise      | `db.sqlite` et `noise_private.key` dans ce répertoire               |
| Socket CLI          | `/run/headscale/headscale.sock`, 0600                               |
| API et coordination | `http://127.0.0.1:8085`, boucle locale uniquement                   |
| Métriques           | `127.0.0.1:9090`, boucle locale uniquement                          |
| Headplane           | utilisateur système `headplane`, `/opt/headplane/current`           |
| Configuration       | `/etc/headplane/config.yaml`, root:`headplane`, 0640                |
| Secrets             | `/etc/headplane/secrets/`, hors Git                                 |
| TLS                 | `/etc/headplane/tls/`, clé privée root:`headplane`, 0640            |
| Autorité TLS        | `/var/lib/headplane-ca/`, root uniquement, 0700                     |
| Données Headplane   | `/var/lib/headplane/`, `headplane:headplane`, 0700                  |
| SQLite Headplane    | `/var/lib/headplane/hp_persist.db`                                  |
| Agent               | `/opt/headplane/current/hp_agent`, état `/var/lib/headplane/agent/` |
| Interface LAN       | `https://192.168.0.120:3000/admin`                                  |
| Développement       | `headplane-dev.service`, `127.0.0.1:3005`, non activé au boot       |
| Sauvegarde          | `/usr/local/sbin/headplane-stack-backup`, `headplane-backup.timer`  |

Les unités sont dans `/etc/systemd/system/`. Headscale et Headplane sont activés
au démarrage. Ils utilisent `Restart=on-failure`, journald, des comptes sans shell,
`UMask=0077`, aucune capacité privilégiée et un système de fichiers majoritairement
en lecture seule. Le compte Headplane peut lire la configuration Headscale via
`headscale-config`, mais ne peut lire sa clé Noise, son SQLite ou son socket CLI.
La configuration Headscale n'est pas modifiable depuis l'interface.

Le hot reload ne modifie pas la release installée. L'agent est un client tsnet
en espace utilisateur : il n'utilise pas le démon Tailscale officiel, ne crée
pas d'interface TUN et n'annonce aucune route. `tailscale_netns: false` utilise
le routage ordinaire pour joindre le serveur sur la boucle locale ; aucun
réglage de routage ou de namespace de l'hôte n'est modifié.

## Commandes usuelles

```bash
sudo systemctl status headscale headplane --no-pager
sudo systemctl restart headscale
sudo systemctl restart headplane
sudo systemctl stop headplane headscale
sudo systemctl start headscale headplane
sudo journalctl -u headscale -u headplane --since '15 minutes ago' --no-pager
sudo journalctl -fu headplane
sudo -u headscale /usr/local/bin/headscale configtest
curl --noproxy '*' http://127.0.0.1:8085/health
curl --noproxy '*' \
  --cacert /home/brokcat/dev/headplane-native-setup/headplane-local-ca.crt \
  https://192.168.0.120:3000/admin/healthz
```

Arrêter Headscale rend temporairement les deux interfaces indisponibles pour
les opérations API. Cela n'arrête pas le VPN Tailscale officiel.
Les commandes suivantes ne concernent que l'instance native :

```bash
sudo -u headscale /usr/local/bin/headscale users list
sudo -u headscale /usr/local/bin/headscale nodes list
sudo -u headscale /usr/local/bin/headscale apikeys list
sudo -u headscale /usr/local/bin/headscale policy get
```

`apikeys list` affiche des métadonnées, pas la valeur récupérable des clés API.
La liste CLI des clés d'inscription peut, elle, contenir des secrets : ne pas
la verser dans des journaux ou des tickets. Utiliser l'interface authentifiée.

## Réseau, DNS, DERP et ACL

`server_url` est `http://127.0.0.1:8085` : il convient à l'agent natif de cet hôte,
pas à l'enrôlement direct d'un poste LAN ou distant. Ne pas présenter cette URL
comme une coordination de production. Un changement d'URL et une publication
HTTPS dédiée seront nécessaires avant un pilote externe.

Plages neuves : `100.90.0.0/24` et `fd7a:115c:a1e0:fffe::/64`, sous-ensembles
des plages supportées par Tailscale. Aucun pair observé lors de l'audit ne les
utilisait. L'absence de conflit doit être revérifiée contre l'inventaire complet
avant toute coexistence de clients ou routage ; les deux systèmes restent dans
les mêmes grandes plages Tailscale.

MagicDNS est configuré pour `headscale.test`, avec
`override_local_dns: false`. Le DNS de l'hôte et le suffixe officiel
`tailc6d37b.ts.net` ne sont pas modifiés. Les clients tsnet ne changent pas le
résolveur global. Le DERP intégré est désactivé ; la carte des relais publics
Tailscale est récupérée en sortie HTTPS. Aucun serveur DERP ni listener STUN
3478 n'est publié par cette installation.

Le client tsnet peut ouvrir un socket UDP dynamique pour son transport WireGuard.
Ce n'est pas l'API d'administration. Aucun port WAN, NAT, pare-feu, reverse proxy
ou conteneur de production n'a été reconfiguré.

Les ACL sont stockées en base (`policy.mode: database`). Politique initiale :
seul `tag:headplane-native-agent` peut initier des connexions vers les nœuds de
cette instance de développement. Le propriétaire du tag est une liste vide :
le tag est attribué par l'API privilégiée lors de la création de la clé d'agent,
pas par un utilisateur ordinaire. Les autres flux ne sont pas autorisés.
La politique initiale de référence est `/etc/headplane/initial-policy.hujson`.

Avant d'importer une autre politique, effectuer une sauvegarde, vérifier la
syntaxe et examiner les droits ; ne pas copier aveuglément l'ancienne politique
de développement, qui était permissive.

```bash
sudo -u headscale /usr/local/bin/headscale policy check --help
sudo -u headscale /usr/local/bin/headscale policy set --help
```

L'édition et l'enregistrement via Headplane ont été testés puis restaurés.
L'approbation de routes a été testée avec une liste vide seulement. Ne pas
activer un Subnet Router ou un Exit Node sans plan et accord distincts.

## Sauvegardes

Sauvegarde initiale de l'ancien environnement :
`/var/backups/headscale/native-bootstrap-20261029-203326/`.

Elle contient `workspace.tar.gz`, `container-rootfs.tar`, les métadonnées Docker,
l'état initial du réseau et des services, et `manifest.json` avec empreintes et
tailles. L'extraction `restore-check/` a permis de contrôler le commit, la présence
du document non suivi et l'intégrité complète des deux SQLite. Aucun serveur
utilisant ces anciennes identités n'a été lancé pour vérifier la restauration.
Le conteneur et le volume originaux sont également conservés.

Les sauvegardes natives sont dans `/var/backups/headscale/native-YYYYMMDD-HHMMSS/` :

```bash
sudo systemctl start headplane-backup.service
sudo systemctl status headplane-backup.service --no-pager
sudo systemctl list-timers headplane-backup.timer --no-pager
sudo journalctl -u headplane-backup.service -n 20 --no-pager
```

Le timer quotidien se déclenche à **03:15, heure locale**, avec un délai aléatoire
de 0 à 10 minutes. Il provoque une brève interruption des **deux seuls nouveaux
services natifs**. Il n'arrête pas le service de développement Vite ; son API
redevient fonctionnelle au retour de Headscale.

Le script arrête ces deux services, copie configurations, secrets, bases, clé
Noise, identité d'agent et autorité TLS, puis emploie l'API de backup SQLite et
`integrity_check`. Il conserve propriétaires et permissions. Les unités et le
script de sauvegarde sont inclus. Il remet en marche uniquement les services
qui étaient actifs avant l'opération, même si l'archivage échoue.

Chaque archive possède son SHA-256 externe et un manifeste interne par fichier.
La première sauvegarde native, `native-20261029-204453`, a été extraite et chaque
empreinte ainsi que les deux bases restaurées ont été vérifiées.

Les binaires et releases `/opt/headplane/` ne sont pas recopiés dans chaque
archive quotidienne. Conserver les artefacts vérifiés, la release et son
`source.patch` avec une sauvegarde hors hôte. La base et l'agent de développement
Vite sont distincts ; ils ne sont pas inclus dans la sauvegarde du service stable.
Le checkout, ses modifications non commitées, les trois documents et
`~/.config/headplane-dev` nécessitent leur propre sauvegarde privée avant réinstallation.

Aucune suppression automatique des sauvegardes n'est configurée. Surveiller
`df -h /` ; environ 56 Gio restaient après l'installation. Prévoir une copie
chiffrée hors hôte : une sauvegarde sur le même disque ne couvre pas sa perte.

## Restauration native — procédure manuelle

Ne pas exécuter simultanément deux Headscale utilisant les mêmes fichiers
d'identité. Une restauration modifie des données : faire approuver la cible et
la sauvegarde choisies avant les commandes d'écrasement.

1. Garder un accès LAN ou console indépendant de Tailscale.
2. Sauvegarder l'état courant avec le service de backup, puis arrêter
   `headplane-dev`, `headplane` et `headscale`.
3. Vérifier `stack.tar.gz.sha256` dans le répertoire choisi, puis extraire
   l'archive dans un répertoire temporaire privé, jamais directement sur `/`.
4. Vérifier toutes les entrées de `SHA256.json` et `PRAGMA integrity_check` sur
   les bases extraites. Ne lancer aucun serveur depuis ce répertoire.
5. Déplacer les répertoires courants vers une sauvegarde de prérestauration,
   puis restaurer `/etc/headscale`, `/etc/headplane`, `/var/lib/headscale`,
   `/var/lib/headplane` et `/var/lib/headplane-ca` depuis l'extraction avec leurs
   propriétaires et permissions. Ne pas superposer une vieille base à un WAL
   d'une autre génération.
6. Vérifier les comptes système et groupes, réinstaller les mêmes versions
   officielles et la release Headplane correspondante. Restaurer les unités si
   nécessaire, puis `sudo systemctl daemon-reload`.
7. Vérifier la configuration ; démarrer Headscale puis Headplane. Contrôler
   `/health`, `/admin/healthz`, l'authentification et la synchronisation de l'agent.
8. Vérifier la confiance du certificat côté navigateur. Ne restaurer le hot
   reload qu'après validation de l'instance stable.

La procédure complète de remplacement des données n'a pas été exécutée sur
l'instance active. L'extraction, les empreintes et les bases restaurées ont été
réellement contrôlées hors ligne.

## Rotation des clés et TLS

La clé administrateur expire initialement le **28 novembre 2026** ; les clés
serveur et de développement le **27 janvier 2027**. Relever les dates réelles
avec les métadonnées `headscale apikeys list` et programmer la rotation avant
ces échéances. L'agent déjà inscrit conserve son identité ; sa gestion nécessite
toutefois une clé serveur valide.

Pour une rotation serveur, sauvegarder d'abord, relever l'identifiant de l'ancienne
clé, puis produire la nouvelle directement dans un fichier privé, sans sortie
du secret sur le terminal :

```bash
sudo systemctl start headplane-backup.service
sudo sh -eu -c '
  umask 077
  sudo -u headscale /usr/local/bin/headscale apikeys create --expiration 90d \
    > /etc/headplane/secrets/service-api-key.new
  chown root:headplane /etc/headplane/secrets/service-api-key.new
  chmod 0640 /etc/headplane/secrets/service-api-key.new
  mv /etc/headplane/secrets/service-api-key.new /etc/headplane/secrets/service-api-key
  systemctl restart headplane
'
```

Vérifier santé et agent avant de révoquer l'ancienne clé avec
`headscale apikeys expire --id ID`, exécuté en tant que `headscale`. En cas
d'échec, restaurer le fichier précédent depuis la sauvegarde avant révocation.
Appliquer la même méthode à la clé administrateur, avec propriétaire root:root,
mode 0600 et durée 30 jours, puis se reconnecter avec la nouvelle clé avant
révocation. La clé de développement doit rester propriétaire `brokcat`, mode 0600.

Le certificat serveur TLS dure un an ; l'autorité locale dure dix ans. Surveiller :

```bash
sudo openssl x509 -in /etc/headplane/tls/server.crt -noout -dates
sudo openssl x509 -in /etc/headplane/tls/server.crt -checkend 2592000 -noout
```

Renouveler le certificat avec l'autorité privée locale, les mêmes SAN IP/DNS et
un nouvel archivage avant remplacement. Ne pas remplacer l'autorité sans prévoir
la redistribution de la confiance. Pour la future production, préférer un nom
DNS stable et un certificat public ; voir le plan de migration.

## Mise à jour et retour arrière

Avant une mise à jour Headscale : lire les notes officielles, sauvegarder, vérifier
la compatibilité Headplane et télécharger/checksummer le nouveau binaire. Une
migration SQLite peut rendre le downgrade du seul binaire impossible. Tester
dans une copie isolée avec **de nouvelles identités**, ou hors ligne, avant bascule.

Pour Headplane, conserver les modifications locales, mettre à jour la branche
sans `reset --hard`, compiler et tester selon `DEV_SETUP.md`, installer une
release séparée et faire pointer `current` dessus. Vérifier immédiatement santé,
connexion et agent. Le déploiement ne pousse aucun commit.

Un retour à une release antérieure nécessite d'arrêter Headplane, remettre le
lien `current` sur la release choisie et redémarrer. Si cette release ne comprend
pas une migration récente de base ou le correctif de cookie, restaurer les données
compatibles ou conserver le service arrêté ; ne pas improviser un downgrade.

Pour annuler l'installation native sans supprimer de données :

```bash
sudo systemctl disable --now headplane-backup.timer
sudo systemctl stop headplane-dev
sudo systemctl disable --now headplane headscale
```

Cela ne touche ni Docker, ni Tailscale, ni les conteneurs de production. Conserver
configurations, clés, bases, sauvegardes et releases. Si un retour à l'ancien
développement est nécessaire, l'ancien environnement indépendant peut être
relancé explicitement :

```bash
docker exec headscale-dev /workspace/dev-services/devctl start
```

Son interface est toujours interne au conteneur ; la publication historique 8080
ne suffit pas à rendre une écoute sur sa boucle locale accessible depuis l'hôte.
Ce rollback ne rétablit donc pas une interface LAN qui n'existait pas auparavant.

## Dépannage et limites

- `address already in use` : examiner `sudo ss -lntup`, les sockets systemd et
  les `HostConfig.PortBindings` de tous les conteneurs. Ne pas arrêter le service
  occupant un port de production. Reconfigurer le seul nouveau service après accord.
- Santé Headplane en erreur : vérifier Headscale, l'expiration de la clé serveur,
  les permissions et les journaux. Une page de connexion seule ne prouve pas que
  l'agent ou les API fonctionnent.
- Agent hors ligne : consulter `/admin/settings/agent`, vérifier le tag de la
  politique, la connexion à `127.0.0.1:8085`, l'exécutable et le répertoire privé
  d'état. Ne pas copier l'identité de l'ancien agent et ne pas activer le VPN
  officiel sur cette coordination pour faire un test.
- Certificat refusé : importer la seule autorité publique sur le poste client,
  vérifier la date et le SAN `192.168.0.120`. Ne pas désactiver durablement la
  validation TLS.
- ACL non éditable : vérifier `policy.mode: database`. DNS et restrictions
  Headscale sont volontairement non modifiables depuis cette interface ; les
  modifier manuellement avec sauvegarde, validation et redémarrage contrôlé.
- Deux services SOC étaient déjà en échec au début :
  `soc-ai-agentic-compose-up.service` et `soc-ai-agentic-docker-user-fw.service`.
  Ils n'ont pas été réparés dans cette mission. Les règles de pare-feu existantes
  ont été conservées et comparées hors compteurs.
- Aucun test d'enrôlement d'un appareil externe, de trafic entre deux clients,
  de Subnet Router, d'Exit Node ou de Browser SSH de bout en bout n'est revendiqué.
