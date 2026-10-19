# Image du site Delta pour la production : construction Vite, puis Caddy,
# qui sert le site, relaie /api vers le backend et gère le certificat HTTPS.
# Construite par docker-compose.prod.yml ; voir docs/deploiement.md.

# Node 24 (npm 11), comme le poste de développement : le fichier
# package-lock.json est produit par npm 11, que npm 10 lit différemment.
FROM node:24-alpine AS construction
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Les variables VITE_ sont figées dans le JavaScript au moment de la
# construction : les changer demande de reconstruire l'image.
# L'API est servie par le même domaine (Caddy relaie /api), d'où une URL
# relative — un seul site au sens des cookies, SameSite=Lax tient.
ARG VITE_FACEBOOK_URL=""
ARG VITE_TELEPHONE_FORMATION=""
ENV VITE_API_URL=/api/v1 \
    VITE_ENVIRONMENT=production \
    VITE_FACEBOOK_URL=$VITE_FACEBOOK_URL \
    VITE_TELEPHONE_FORMATION=$VITE_TELEPHONE_FORMATION
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=construction /app/dist /srv
