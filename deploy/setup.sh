#!/usr/bin/env bash
# Run on the Oracle Ubuntu VM as the ubuntu user: bash deploy/setup.sh
set -euo pipefail

sudo apt-get update
sudo apt-get install -y nginx git curl ca-certificates certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Oracle Ubuntu images ship with iptables rules that block 80/443
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save || true

cd ~/campus-hub
[ -f .env ] || { echo "Create ~/campus-hub/.env first (see deploy/README.md)"; exit 1; }
set -a; . ./.env; set +a

npm ci
npx prisma generate --schema=apps/api/prisma/schema.prisma
npm run build -w apps/api
npx prisma db push --schema=apps/api/prisma/schema.prisma

sudo cp deploy/campushub.service /etc/systemd/system/campushub.service
sudo systemctl daemon-reload
sudo systemctl enable --now campushub
sudo systemctl restart campushub
echo "Done. Check: curl localhost:4000/health"
