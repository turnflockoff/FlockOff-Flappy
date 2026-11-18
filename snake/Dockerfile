# Portable container for SNAKE! SNAKE! Multiplayer — runs on Fly.io, Railway,
# a VPS, or any Docker host.  Build:  docker build -t snake .
# Run:    docker run -p 8080:8080 -e PORT=8080 snake
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
