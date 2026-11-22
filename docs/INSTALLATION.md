# Installer Syllig Study sur le VPS 1

Durée : environ 15 minutes. La suite Syllig n'est **pas** interrompue : Syllig Study tourne dans ses propres conteneurs, avec sa propre base, et Caddy est simplement rechargé (sans coupure) avec un bloc de plus.

## 0. DNS (une fois)
Chez le registraire de `syllig.com` (là où sont déclarés bet, achat, stock…), créer :
- `study` · type **A** · `145.239.79.32`
- `study` · type **AAAA** · `2001:41d0:305:2100::1:3b1a`

## 1. Envoyer l'archive sur le serveur (PowerShell, sur votre PC)
```
scp $env:USERPROFILE\Downloads\syllig-study.tar.gz ubuntu@145.239.79.32:/tmp/
```

## 2. Installer (sur le serveur)
```
ssh ubuntu@145.239.79.32
sudo mkdir -p /opt/syllig-study
sudo tar xzf /tmp/syllig-study.tar.gz -C /opt/syllig-study
cd /opt/syllig-study
sudo ./deploy/install.sh study.syllig.com
```
Le script : génère le mot de passe de la base (`.env`, à ne pas diffuser), construit et démarre les conteneurs, ajoute le bloc `study.syllig.com` au Caddyfile (sauvegarde `/etc/caddy/Caddyfile.avant-study`, restauration automatique si Caddy refuse la configuration), installe la sauvegarde nocturne de la base.

## 3. Créer les comptes (sur le serveur, toujours dans /opt/syllig-study)
```
sudo docker compose exec app node scripts/create-user.mjs admin
sudo docker compose exec app node scripts/create-user.mjs family
```
Les questions s'affichent une à une ; les mots de passe ne s'affichent pas à la saisie.

## 4. Publier le premier cours (dans le navigateur)
1. Ouvrir https://study.syllig.com et se connecter avec le compte administrateur.
2. « Format et consigne IA » → télécharger l'exemple `C001.json`.
3. « Importer un cours » → choisir ce fichier → relire l'aperçu → « Publier cette version ».

## Mettre à jour plus tard
Envoyer la nouvelle archive comme à l'étape 1, puis :
```
cd /opt/syllig-study && sudo tar xzf /tmp/syllig-study.tar.gz -C /opt/syllig-study && sudo ./deploy/install.sh study.syllig.com
```
Les données sont conservées (volume Docker `syllig-study_db-data`) ; les migrations de base s'appliquent toutes seules.

## Sauvegardes
- Automatique chaque nuit à 3 h 17 dans `/opt/syllig-study/backups/` (30 jours conservés), en plus de la sauvegarde OVH du VPS.
- À la main : `sudo /opt/syllig-study/deploy/backup.sh`
- Restaurer : `gunzip -c backups/<fichier>.sql.gz | sudo docker compose exec -T db psql -U syllig syllig`

## En cas de problème
- État : `sudo docker compose ps` · journal : `sudo docker compose logs --tail 100 app`
- Retirer Syllig Study du Caddyfile : `sudo cp /etc/caddy/Caddyfile.avant-study /etc/caddy/Caddyfile && sudo systemctl reload caddy`
- Arrêter Syllig Study (sans toucher à la suite Syllig) : `sudo docker compose down` (les données restent)
