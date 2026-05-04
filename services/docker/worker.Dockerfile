FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY tsconfig.base.json vitest.config.ts vite.config.ts ./
COPY frontend ./frontend
COPY infra ./infra
COPY services ./services
COPY tests ./tests

CMD ["npx", "tsx", "services/docker/run-local-worker.ts"]