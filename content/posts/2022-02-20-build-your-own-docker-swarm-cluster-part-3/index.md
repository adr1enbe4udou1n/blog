---
title: "Setup a Docker Swarm cluster - Part III"
date: 2022-02-20
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
slug: build-your-own-docker-swarm-cluster-part-3
draft: true
---

{{< lead >}}
Build your own cheap while powerful self-hosted complete CI/CD solution by following this opinionated guide 🎉
{{< /lead >}}

This is the **Part III** of more global topic tutorial. [Back to first part]({{< ref "/posts/2022-02-13-build-your-own-docker-swarm-cluster" >}}) to start from beginning.

## Keep the containers image up-to-date

It's finally time to test our new cluster environment by testing some images through the Portainer GUI. We'll start by installing [`Diun`](https://crazymax.dev/diun/), a nice tool for keeping our images up-to-date.

Create a new `diun` stack through Portainer and set following content :

```yml
version: "3.2"

services:
  diun:
    image: crazymax/diun:latest
    command: serve
    volumes:
      - /mnt/storage-pool/diun:/data
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      TZ: Europe/Paris
      DIUN_WATCH_SCHEDULE: 0 */6 * * *
      DIUN_PROVIDERS_SWARM: 'true'
      DIUN_PROVIDERS_SWARM_WATCHBYDEFAULT: 'true'
      DIUN_NOTIF_MAIL_HOST:
      DIUN_NOTIF_MAIL_PORT:
      DIUN_NOTIF_MAIL_USERNAME:
      DIUN_NOTIF_MAIL_PASSWORD:
      DIUN_NOTIF_MAIL_FROM:
      DIUN_NOTIF_MAIL_TO:
    deploy:
      placement:
        constraints:
          - node.role == manager
```

{{< tabs >}}
{{< tab tabName="volumes" >}}

| name                     | description                                                                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/mnt/storage-pool/diun` | It will be used for storage of Diun db location, Diun need it for storing detection of new images version and avoid notification spams. **Don't forget** to create a new dedicated folder in the GlusterFS volume with `sudo mkdir /mnt/storage-pool/diun`. |
| `/var/run/docker.sock`   | For proper current docker images used detection through Docker API                                                                                                                                                                                          |

{{< /tab >}}
{{< tab tabName="environment" >}}

| name                                  | description                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `TZ`                                  | Required for proper timezone schedule                                                 |
| `DIUN_WATCH_SCHEDULE`                 | The standard linux cron schedule                                                      |
| `DIUN_PROVIDERS_SWARM`                | Required for detecting all containers on all nodes                                    |
| `DIUN_PROVIDERS_SWARM_WATCHBYDEFAULT` | If `true`, no need of explicit docker label everywhere                                |
| `DIUN_NOTIF_MAIL_*`                   | Set all according to your own mail provider, or use any other supported notification. |

{{< alert >}}
Use below section of Portainer for setting all personal environment variable. In all cases, all used environment variables must be declared inside YML.
{{< /alert >}}

{{< /tab >}}
{{< /tabs >}}

![Diun Stack](diun-stack.png)

Finally click on **Deploy the stack**, it's equivalent of precedent `docker stack deploy`, nothing magic here. At the difference that Portainer will store the YML inside his volume, allowing full control, contrary to limited Traefik and Portainer cases.

Diun should now be deployed and manager host and ready to scan images for any updates !

You can check the full service page which will allows manual scaling, on-fly volumes mounting, environment variable modification, and show current running tasks (aka containers).

![Diun Service](diun-service.png)

You can check the service logs which consist of all tasks logs aggregate.

![Diun Logs](diun-logs.png)

## Installation of databases

It's finally time to install some RDBS. The most commons are *MySQL* and *PostgreSQL*. I advise the last one nowadays, but I'll show you how to install both, web GUI managers included. Choose the best suited DB for your own needs.

We'll install this DB obviously on `data-01` as shown in [previous part II schema]({{< ref "/posts/2022-02-18-build-your-own-docker-swarm-cluster-part-2#network-file-system" >}}).

### MySQL 8

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

![phpMyAdmin](phpmyadmin.png)

### PostgreSQL 14

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

![pgAdmin](pgadmin.png)
