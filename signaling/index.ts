import fs from "fs";
import https from "https";
import express from "express";
import mediasoup, { types } from "mediasoup";
import { Server } from "socket.io";
import config from "./config/config.js";
const app = express();

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST"],
};

const key = fs.readFileSync("./config/cert.key");
const cert = fs.readFileSync("./config/cert.crt");
const options = { key, cert };

const httpsServer = https.createServer(options, app);
const io = new Server(httpsServer, {
  transports: ["websocket"],
  cors: corsOptions,
});
const workers: Array<types.Worker> = [];
let nextMediasoupWorkerIdx = 0;
const numWorkers = config.numWorkers;
function startServer() {
  app.use((req: Request, res: Response, next: Function) => {
    console.log("New request:", {
      headers: req.headers,
      body: req.body,
      method: req.method,
    });
    next();
  });
  // ####################################################
  // START SERVER
  // ####################################################

  httpsServer.listen(config.port, () => {});

  // ####################################################
  // WORKERS
  // ####################################################

  (async () => {
    try {
      await createWorkers();
    } catch (err) {
      console.error("Create Worker ERROR --->", err);
      process.exit(1);
    }
  })();

  async function createWorkers() {
    console.log("WORKERS:", numWorkers);
  }
}
startServer();
