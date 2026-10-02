# Dockerfile de desenvolvimento — hot reload via volume montado pelo docker-compose.
# Para produção, criar um Dockerfile multi-stage separado (build + next start) quando chegar a hora.

FROM node:20-alpine

# node:20-alpine não vem com OpenSSL — sem isso o motor do Prisma falha ao
# rodar migrations com "Could not parse schema engine response". Também não
# vem com tzdata — sem isso TZ=America/Sao_Paulo (docker-compose.yml) é ignorado.
RUN apk add --no-cache openssl tzdata chromium

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
