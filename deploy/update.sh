#!/usr/bin/env bash
# Redeploy latest main on the VM: bash deploy/update.sh
set -euo pipefail
cd ~/campus-hub
git pull origin main
set -a; . ./.env; set +a
npm ci
npx prisma generate --schema=apps/api/prisma/schema.prisma
npm run build -w apps/api
sudo systemctl restart campushub
