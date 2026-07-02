# Deploying this app on the Zabbix VM

This app (frontend + backend) will run **on the same VM that already hosts
the Zabbix database**. Because the database is local to that VM, the backend
can just connect to `localhost` — no cross-VM networking needed.


## Step 0 — Get access to the VM

Ask your manager for:

1. **The VM's IP address / hostname.**
2. **A login** — username + password, or an SSH key file.
3. **Sudo rights** on that account — installing software and opening
   firewall ports needs elevated privileges, a plain user account won't do.
4. **MySQL access to create a user** — either root/admin credentials for
   MySQL, or ask your manager to run the `CREATE USER` / `GRANT` commands in
   Step 4 themselves (safer: they keep root, you only get the scoped
   read-only user).

### How you'll connect once you have the above

The VM is confirmed **Ubuntu**, so you'll connect over SSH — use
[PuTTY](https://www.putty.org/) (or Windows Terminal's built-in `ssh`
command) to open a text terminal:

```
ssh yourusername@<vm-ip>
```

---

## Step 1 — Get the code onto the VM

```bash
sudo apt update
sudo apt install -y git
git clone <this-repo-url> rkpi
cd rkpi
```

(If the repo is private, you'll need a GitHub personal access token or SSH
key set up on the VM to clone it.)

---

## Step 2 — Choose an approach

Two ways to run it. **Bare-metal is recommended here** — since the app and
the database now live on the same machine, Docker adds networking
complexity (container-to-host routing, widening MySQL's bind address) for no
real benefit in this single-VM setup.

| | Bare-metal (recommended) | Docker |
|---|---|---|
| Installs | Node.js, nginx, pm2 | Docker only |
| DB connection | `localhost:3306` directly | needs `host.docker.internal` + MySQL listening beyond `127.0.0.1` |
| Complexity | Lower | Higher (extra firewall/bind-address work) |

Follow **Step 3A** for bare-metal, or **Step 3B** for Docker. Don't do both.

---


---

## Step 3B — Docker install (alternative)

Only follow this if you specifically want Docker instead of Step 3A.

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in for the group change to apply
```

Edit `docker-compose.prod.yml`, add `extra_hosts` under `backend`:

```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  container_name: rkpi_backend
  restart: unless-stopped
  env_file:
    - ./backend/.env
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

`backend/.env`:

```
DB_ZABBIX_HOST=host.docker.internal
DB_ZABBIX_PORT=3306
```
(same other variables as Step 3A above — leave `DB_GLPI_*` out until GLPI's
VM is ready)

MySQL must accept connections from the Docker bridge network, not just
`127.0.0.1`. Edit `/etc/mysql/mariadb.conf.d/50-server.cnf`:

```
bind-address = 0.0.0.0
```

```bash
sudo systemctl restart mariadb
```

Check the Docker bridge subnet and scope the MySQL user to it:

```bash
docker network inspect bridge | grep Subnet
```
```sql
CREATE USER 'reporter'@'172.17.0.%' IDENTIFIED BY 'strong-password-here';
GRANT SELECT ON zabbix.* TO 'reporter'@'172.17.0.%';
FLUSH PRIVILEGES;
```

Block MySQL from the VM's real network interface, since `0.0.0.0` now
exposes it there too:

```bash
sudo ufw deny 3306
sudo ufw allow in on docker0 to any port 3306
```

Bring the app up:

```bash
cd ~/rkpi
docker compose -f docker-compose.prod.yml up -d --build
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## Quick reference: what goes where

| Thing | Value | Source |
|---|---|---|
| VM IP/hostname, login | — | Your manager |
| MySQL root access (or scoped user) | — | Your manager |
| `DB_ZABBIX_*` in `.env` | `localhost` / `3306` (bare-metal) or `host.docker.internal` / `3306` (Docker) | This VM |
| `DB_GLPI_*` in `.env` | leave unset for now | Add once GLPI's VM is ready |
| `JWT_SECRET` | any long random string | Generate yourself, e.g. `openssl rand -hex 32` |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | app login credentials | Pick your own |
| `CORS_ORIGIN` | `http://<vm-ip-or-domain>` | This VM's address |
| `SMTP_*` | mail server credentials | Whoever manages your email/reporting |
