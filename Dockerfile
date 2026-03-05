FROM node:20-alpine

WORKDIR /app

# install frontend deps
COPY package*.json ./
RUN npm install

# copy toàn bộ project
COPY . .

# build React
RUN npm run build

# install backend deps
WORKDIR /app/backend
RUN npm install --omit=dev

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "backend/server.js"]