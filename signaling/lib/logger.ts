import winston from "winston";
const logs = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.splat(),
        winston.format.colorize(),
        winston.format.simple()
        //
        // winston.format.printf((info) => {
        //   if (typeof info.message === "object") {
        //     info.message = JSON.stringify(info.message, null, 3);
        //   }

        //   return info.message as unknown as string;
        // })
      ),
    }),
  ],
});
export default logs;
