# Cloud Run image for the A Square Solutions AI engine (Next.js).
# Serves the ScamCheck / TrustScore / embeddings API routes + dashboards.
# Cloud Run injects $PORT; Next binds to it. Stateless, scales to zero.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
# Copy build output + runtime deps + content (needed by the content routes).
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
COPY --from=build /app/content ./content
COPY --from=build /app/next.config.mjs ./next.config.mjs
EXPOSE 8080
ENV PORT=8080
# next start binds to $PORT (Cloud Run default 8080).
CMD ["npm", "run", "start", "--", "-p", "8080", "-H", "0.0.0.0"]
