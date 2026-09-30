FROM node:22-alpine AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY client ./client
RUN npm run build:client

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3210 DATA_BACKEND=firestore
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY --from=client-build /app/public/firebase-auth.js ./public/firebase-auth.js
USER node
EXPOSE 3210
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3210/api/health || exit 1
CMD ["node", "server.js"]
