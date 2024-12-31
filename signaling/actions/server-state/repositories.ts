import { Repository } from "redis-om";
import redis from "../../lib/redis";
import {
  consumerSchema,
  peerSchema,
  producerSchema,
  roomSchema,
  routerSchema,
  transportSchema,
} from "./schemas";
const peerRepository = new Repository(peerSchema, redis);
const roomRepository = new Repository(roomSchema, redis);
const routerRepository = new Repository(routerSchema, redis);
const transportRepository = new Repository(transportSchema, redis);
const producerRepository = new Repository(producerSchema, redis);
const consumerRepository = new Repository(consumerSchema, redis);

export {
  peerRepository,
  roomRepository,
  routerRepository,
  transportRepository,
  producerRepository,
  consumerRepository,
};
