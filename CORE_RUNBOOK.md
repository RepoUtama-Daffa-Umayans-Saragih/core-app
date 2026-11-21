# C.O.R.E. (City Optimized Rescue Edge) - Runbook
- **Tim:** Cara DaftarnyaGimana (Universitas Sumatera Utara)[cite: 21]
- **Kontak:** WhatsApp +62 857-6973-7410 / 0857-6973-7410 | Email: daffaumayans@students.usu.ac.id[cite: 21]
- **Domain:** oursites.tech / core.oursites.tech (via GitHub Student Developer Pack / Name.com)
- **Server ECS:** ecs-994a (AP-Jakarta, Ubuntu 22.04) | IP Publik: 110.239.87.117
- **Proses Aplikasi:** Node.js + PM2 (core-app) di balik Nginx + Let's Encrypt Certbot

## 1. Update Kode dari GitHub ke Server ECS (CloudShell)
cd ~/core-app && \
git fetch origin main && \
git reset --hard origin/main && \
rm -rf .next && \
npm install && \
npm run build && \
pm2 restart core-app && \
pm2 status

## 2. Pasang Domain / Subdomain & SSL HTTPS di Nginx (CloudShell)
DOMAIN="core.oursites.tech"
sed -i "s/server_name .*/server_name $DOMAIN;/" /etc/nginx/sites-available/core-app
nginx -t && systemctl restart nginx
certbot --nginx -d "$DOMAIN"

## 3. Reset Kembali ke Akses IP Port 80 (Jika Diperlukan)
cat << 'EOF' > /etc/nginx/sites-available/core-app
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/core-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
