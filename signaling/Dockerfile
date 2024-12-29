FROM node:20 AS build
RUN apt-get update && apt-get install -y net-tools build-essential git python3 python3-pip
WORKDIR /app
COPY package.json .
RUN npm i >&2

FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=build /app .
COPY ./config ./config
COPY ./lib ./lib 
COPY ./actions ./actions
CMD npx nodemon --exec tsx server.ts