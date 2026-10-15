# Deploying CampusHub on Oracle Cloud (Always Free)

One VM runs everything: Node serves the API and the built web app on port 4000, Nginx proxies 80/443 to it.

## 1. Create the VM
1. Oracle Cloud Console > Compute > Instances > Create.
2. Image: Ubuntu 22.04 (or 24.04). Shape: Ampere `VM.Standard.A1.Flex`, 2 OCPU / 12 GB (Always Free).
   If "out of capacity", retry later or use `VM.Standard.E2.1.Micro`.
3. Download the SSH private key. Note the public IP.
4. VCN > Subnet > Security List > add ingress rules for TCP 80 and 443 from 0.0.0.0/0.

## 2. Domain
Point an A record for your domain at the VM's public IP. Free option: duckdns.org.
Let's Encrypt needs a real hostname (not a bare IP).

## 3. MongoDB Atlas
Network Access > add the VM's public IP (or 0.0.0.0/0 for testing).

## 4. Get the code onto the VM
    ssh -i <key> ubuntu@<IP>
    git clone <repo-url> ~/campus-hub

## 5. Create ~/campus-hub/.env
    DATABASE_URL="mongodb+srv://..."
    JWT_SECRET="<long random string>"
    ALLOWED_EMAIL_DOMAIN="fanshaweonline.ca"
    BREVO_API_KEY="..."
    EMAIL_FROM_ADDRESS="..."
    CLIENT_URL="https://YOUR_DOMAIN"
    APP_URL="https://YOUR_DOMAIN"

## 6. Run setup
    bash deploy/setup.sh

## 7. Nginx + HTTPS
    sudo cp deploy/nginx.conf /etc/nginx/sites-available/campushub
    sudo sed -i 's/YOUR_DOMAIN/your.domain.com/' /etc/nginx/sites-available/campushub
    sudo ln -s /etc/nginx/sites-available/campushub /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl reload nginx
    sudo certbot --nginx -d your.domain.com

## Operations
- Logs: `journalctl -u campushub -f`
- Redeploy: `bash deploy/update.sh`
- Health: `curl localhost:4000/health`
