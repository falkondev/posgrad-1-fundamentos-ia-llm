FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npx", "browser-sync", "start", \
     "--server", \
     "--files", "index.html,style.css,src/**/*,data/**/*", \
     "--port", "3000", \
     "--host", "0.0.0.0", \
     "--no-open", \
     "--no-ui"]
