# Syllig Study — image de production (Next.js autonome + outils de base de données)
# (Le secret « ca » est facultatif : il ne sert qu'aux environnements derrière un proxy TLS ; inutile sur le VPS.)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=ca,required=false sh -c '[ -f /run/secrets/ca ] && export NODE_EXTRA_CA_CERTS=/run/secrets/ca; npm ci --no-audit --no-fund'
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# dépendances complètes des scripts (migrations, catalogue, comptes)
FROM node:22-alpine AS tools
WORKDIR /tools
RUN --mount=type=secret,id=ca,required=false sh -c '[ -f /run/secrets/ca ] && export NODE_EXTRA_CA_CERTS=/run/secrets/ca; npm init -y >/dev/null && npm install --no-audit --no-fund postgres@3.4.7 bcryptjs@3.0.3'

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --chown=app:app --from=build /app/.next/standalone ./
COPY --chown=app:app --from=build /app/.next/static ./.next/static
COPY --chown=app:app --from=build /app/public ./public
COPY --chown=app:app --from=build /app/content ./content
COPY --chown=app:app --from=build /app/db ./db
COPY --chown=app:app --from=build /app/scripts ./scripts
COPY --chown=app:app --from=tools /tools/node_modules/postgres ./node_modules/postgres
COPY --chown=app:app --from=tools /tools/node_modules/bcryptjs ./node_modules/bcryptjs
RUN rm -rf ./node_modules/@img
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/connexion >/dev/null || exit 1
CMD ["sh", "-c", "node scripts/migrate.mjs && node scripts/seed.mjs && exec node server.js"]
