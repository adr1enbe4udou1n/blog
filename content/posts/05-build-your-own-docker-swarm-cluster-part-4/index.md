---
title: "Setup a Docker Swarm cluster Part IV - DB & backups"
date: 2022-02-18
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
draft: true
---

{{< lead >}}
Build your own cheap while powerful self-hosted complete CI/CD solution by following this opinionated guide 🎉
{{< /lead >}}

This is the **Part IV** of more global topic tutorial. [Back to first part]({{< ref "/posts/02-build-your-own-docker-swarm-cluster" >}}) to start from beginning.

## Installation of databases

It's finally time to install some RDBS. The most commons are *MySQL* and *PostgreSQL*. I advise the last one nowadays, but I'll show you how to install both, web GUI managers included. Choose the best suited DB for your own needs.

We'll install this DB obviously on `data-01` as shown in [previous part II schema]({{< ref "/posts/03-build-your-own-docker-swarm-cluster-part-2#network-file-system" >}}).

### MySQL 8 🐬

```sh
# on ubuntu 20.04, it's just as simple as next
sudo apt install -y mysql-server

# do some secure setup
sudo mysql_secure_installation # let remote root access enabled
```

Now we need to allow remote root access to the DB from docker nodes in the private network. In MySQL it consists on create a new root user for external host.

First edit `/etc/mysql/mysql.conf.d/mysqld.cnf` file and comment `bind-address` line. Then `sudo service mysql restart` to apply it.

Next use `sudo mysql` then execute following SQL queries :

```sql
CREATE USER 'root'@'10.0.0.0/8' IDENTIFIED WITH caching_sha2_password BY 'myawesomepassword';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'10.0.0.0/8' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```

*10.0.0.0/8* correspond to the subnet mask of private network.

#### Testing remotely via mysql

It's now time to confirm remote root access working. Connect to the `manager-01` host :

```sh
# install the client
sudo apt install -y mysql-client

# you should correctly access to your DB after password prompt
mysql -hdata-01 -uroot -p

# save mysql credentials in local swarm account
mysql_config_editor set -hdata-01 -uroot -p
```

With last command, you now access the db directly from the manager by
`mysql` !

#### phpMyAdmin

We are now ready to go for installing phpMyAdmin as GUI DB manager. Thanks to our Docker Swarm cluster, it's super simple !

Create a new `phpmyadmin` stack with following :

```yml
version: '3.8'

services:
  app:
    image: phpmyadmin/phpmyadmin:5
    volumes:
      - /etc/hosts:/etc/hosts
    environment:
      MYSQL_ROOT_PASSWORD:
      PMA_HOST: data-01
      UPLOAD_LIMIT: 50M
    networks:
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.services.phpmyadmin.loadbalancer.server.port=80
        - traefik.http.routers.phpmyadmin.middlewares=admin-ip
      placement:
        constraints:
          - node.role == manager

networks:
  traefik_public:
    external: true
```

The important part is `/etc/hosts` in order to allow proper DNS resolving for `data-01` configured in `PMA_HOST` environment variable. This will avoid us from dragging the real IP of data server everywhere...

Deploy it, and you should access to <https://phpmyadmin.sw.okami101.io> after few seconds, with full admin access to your MySQL DB !

[![phpMyAdmin](phpmyadmin.png)](phpmyadmin.png)

### PostgreSQL 14 🐘

```sh
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get -y install postgresql-14
```

Let's allow remote access by editing `/etc/postgresql/14/main/postgresql.conf` and setting `listen_addresses = '*'`

Next edit `/etc/postgresql/14/main/pg_hba.conf` and add following line :

```conf
host    all    all    10.0.0.0/8    scram-sha-256
```

Finally, apply these by `sudo service postgresql restart`.

Now create our dedicated super admin `swarm` user :

```sh
# create superadmin swarm user
sudo -u postgres createuser swarm -s

# create the user db
sudo -u postgres createdb swarm
```

Then set the password with `sudo -u postgres psql` and execute following SQL query :

```sql
alter user swarm with encrypted password 'myawesomepassword';
```

#### Testing remotely via psql

It's now time to confirm remote root access working. Connect to the `manager-01` host :

```sh
# install the client
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get -y install postgresql-client-14

# you should correctly access to your DB after password prompt
psql -hdata-01 -Uswarm
```

For credential storing, create a `.pgpass` file with chmod 600 with following content format : `data-01:5432:swarm:swarm:myawesomepassword`

With last command, you can now access the db directly from the manager by
`psql -hdata-01` !

#### pgAdmin

We are now ready to go for installing pgAdmin as GUI DB manager.

First create a pgadmin storage folder with proper permissions :

```sh
sudo mkdir /mnt/storage-pool/pgadmin
sudo chown -R 5050:5050 /mnt/storage-pool/pgadmin/
```

Finally, create a new `pgadmin` stack with following :

```yml
version: '3.8'

services:
  app:
    image: dpage/pgadmin4
    volumes:
      - /etc/hosts:/etc/hosts
      - /mnt/storage-pool/pgadmin:/var/lib/pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL:
      PGADMIN_DEFAULT_PASSWORD:
    networks:
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.services.pgadmin.loadbalancer.server.port=80
        - traefik.http.routers.pgadmin.middlewares=admin-ip
      placement:
        constraints:
          - node.role == manager

networks:
  traefik_public:
    external: true
```

You'll need both `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` variable environment for proper initialization.

Deploy it, and you should access after few seconds to <https://pgadmin.sw.okami101.io> with the default logins just above.

Once logged, you need to add the previously configured PostgreSQL server address via *Add new server*. Just add relevant host informations in *Connection* tab. Host must stay `data-01` with swarm as superuser access.

Save it, and you have now full access to your PostgreSQL DB !

[![pgAdmin](pgadmin.png)](pgadmin.png)

## Further cluster app testing

Let's now test our cluster with 2 app samples. We'll deploy them to the worker node.

### Redmine over MySQL

Redmine is a popular app for ticketing based on Ruby on Rails. With the docker based cluster, no more headache for installing !

We'll be starting by creating the `redmine` DB with dedicated user through above phpMyAdmin. For that simply create a new `redmine` account and always specify `10.0.0.0/8` inside host field. Don'forget to check *Create database with same name and grant all privileges*.

{{< alert >}}
Use `Native MySQL authentication` as authentication plugin, as Redmine doesn't support sha2 yet.
{{< /alert >}}

Create dedicated storage folder :

```sh
sudo mkdir /mnt/storage-pool/redmine

# for config file
sudo mkdir /mnt/storage-pool/redmine/config

# for files upload
sudo mkdir /mnt/storage-pool/redmine/files

# for custom plugins
sudo mkdir /mnt/storage-pool/redmine/plugins

# for any custom themes
sudo mkdir /mnt/storage-pool/redmine/themes

# save default config locally
sudo wget https://raw.githubusercontent.com/redmine/redmine/master/config/configuration.yml.example
-O /mnt/storage-pool/redmine/config/configuration.yml

# generate a random key for REDMINE_SECRET_KEY_BASE
cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 40 | head -n 1
```

Next create new following `redmine` stack :

```yml
version: '3.8'

services:
  app:
    image: redmine:4.2
    volumes:
      - /etc/hosts:/etc/hosts
      - ${ROOT_PATH}/config/configuration.yml:/usr/src/redmine/config/configuration.yml
      - ${ROOT_PATH}/files:/usr/src/redmine/files
      - ${ROOT_PATH}/plugins:/usr/src/redmine/plugins
      - ${ROOT_PATH}/themes:/usr/src/redmine/public/themes
    environment:
      REDMINE_DB_MYSQL:
      REDMINE_DB_DATABASE:
      REDMINE_DB_USERNAME:
      REDMINE_DB_PASSWORD:
      REDMINE_SECRET_KEY_BASE:
    networks:
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.services.redmine.loadbalancer.server.port=3000
      placement:
        constraints:
          - node.labels.environment == production

networks:
  traefik_public:
    external: true
```

Configure `REDMINE_DB_*` with proper above created DB credential and set the random key to `REDMINE_SECRET_KEY_BASE`.

{{< alert >}}
I use a dynamic `ROOT_PATH` here. So you must add this variable with `/mnt/storage-pool/redmine` value in the below *Environment variables* section of portainer.
{{< /alert >}}

After few seconds, <https://redmine.sw.okami101.io> should be accessible and ready to use, use admin / admin for admin connection !

[![Redmine](redmine.png)](redmine.png)

### N8N over PostgreSQL

N8N is a popular No Code tool which can be self-hosted. Lets quick and done install with PostgreSQL.

First connect to pgAdmin and create new n8n user and database. Don't forget *Can login?* in *Privileges* tab, and set n8n as owner on database creation.

Create storage folder with `sudo mkdir /mnt/storage-pool/n8n` and create new following stack :

```yml
version: "3"

services:
  app:
    image: n8nio/n8n
    volumes:
      - /etc/hosts:/etc/hosts
      - /mnt/storage-pool/n8n:/home/node/.n8n
    environment:
      DB_TYPE:
      DB_POSTGRESDB_DATABASE:
      DB_POSTGRESDB_HOST:
      DB_POSTGRESDB_USER:
      DB_POSTGRESDB_PASSWORD:
    networks:
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.services.n8n.loadbalancer.server.port=5678
        - traefik.http.routers.n8n.middlewares=admin-auth
      placement:
        constraints:
          - node.labels.environment == production

networks:
  traefik_public:
    external: true
```

And voilà, it's done, n8n will automatically migrate the database and <https://n8n.sw.okami101.io> should be soon accessible. Note as we use `admin-auth` middleware because n8n doesn't offer authentication. Use the same Traefik credentials.

[![n8n](n8n.png)](n8n.png)

## Data backup 💾

Because backup should be taken care from the beginning, I'll show you how to use `Restic` for simple backups to external S3 compatible bucket. We must firstly take care about databases dumps.

### Database dumps

Provided scripts will dump a dedicated file for each database. Fill free to adapt to your own needs.

{{< tabs >}}
{{< tab tabName="MySQL" >}}

Create executable script at /usr/local/bin/backup-mysql

```sh
#!/bin/bash

target=/var/backups/mysql
mkdir -p $target
rm -f $target/*.sql.gz

databases=`mysql -Be 'show databases' | egrep -v 'Database|information_schema|performance_schema|sys'`

for db in $databases; do
  mysqldump --force $db | gzip > $target/$db.sql.gz
done;
```

Then add `0 * * * * /usr/local/bin/backup-mysql` to system cron `/etc/crontab` for dumping every hour.

{{< /tab >}}
{{< tab tabName="PostgreSQL" >}}

Create executable script at /usr/local/bin/backup-postgresql

```sh
#!/bin/bash

target=/var/lib/postgresql/backups
mkdir -p $target
rm -f $target/*.gz

databases=`psql -q -A -t -c 'SELECT datname FROM pg_database' | egrep -v 'template0|template1'`

for db in $databases; do
  pg_dump $db | gzip > $target/$db.gz
done;

pg_dumpall --roles-only | gzip > $target/roles.gz
```

> Use it via `crontab -e` as postgres user.
> `0 * * * * /usr/local/bin/backup-postgresql`

Then add `0 * * * * /usr/local/bin/backup-postgresql` to postgres cron for dumping every hour. To access postgres cron, do `sudo su postgres` and `crontab -e`.

{{< /tab >}}
{{< /tabs >}}

{{< alert >}}
This scripts doesn't provide rotation of dumps, as the next incremental backup will be sufficient.
{{< /alert >}}

### Incremental backup with Restic

```sh
wget https://github.com/restic/restic/releases/download/v0.12.1/restic_0.12.1_linux_amd64.bz2
bzip2 -d restic_0.12.1_linux_amd64.bz2
chmod +x restic_0.12.1_linux_amd64
sudo mv restic_0.12.1_linux_amd64 /usr/local/bin/restic
restic self-update
sudo restic generate --bash-completion /etc/bash_completion.d/restic
```

Some config files :

{{< tabs >}}
{{< tab tabName="~/.restic-env" >}}

Replace next environment variables with your own S3 configuration.

```sh
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export RESTIC_REPOSITORY="s3:server-url/bucket-name/backup"
export RESTIC_PASSWORD="a-strong-password"
```

{{< /tab >}}
{{< tab tabName="/etc/restic/excludes.txt" >}}

Here some typical folders to exclude from backup.

```txt
.glusterfs
node_modules
```

{{< /tab >}}
{{< /tabs >}}

1. Add `. ~/.restic-env` to `.profile`
2. Reload profile with `source ~/.profile`
3. Create a repository with `restic init` (if using rclone instead above keys)
4. Add following cron for backup every hour at 42min :

```txt
42 * * * * . ~/.restic-env; /usr/local/bin/restic backup -q /mnt/HC_Volume_xxxxxxxx/gluster-storage /var/backups/mysql /var/lib/postgresql/backups --exclude-file=/etc/restic/excludes.txt; /usr/local/bin/restic forget -q --prune --keep-hourly 24 --keep-daily 7 --keep-weekly 4 --keep-monthly 3
```

You now have full and incremental backup of GlusterFS volume and dump databases !

{{< alert >}}
Always testing the restoration !
{{< /alert >}}

## 3rd check ✅

We've done the databases part with some more real case app containers samples.

In real world, we should have full monitoring suite, this will be [next part]({{< ref "/posts/05-build-your-own-docker-swarm-cluster-part-4" >}}).
