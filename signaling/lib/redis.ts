import { createClient } from "redis";
const client = createClient({ url: "redis://cache:6379" });
client.on("error", (err) => {
  console.error("Redis Client Error", err);
});
export default client;
