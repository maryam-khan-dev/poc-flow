import { types as MediasoupTypes } from "mediasoup";
import os from "os";
const config = {
  port: 3030,
  numWorkers: os.cpus().length,
  workerSettings: {
    logLevel: "warn",
    logTags: [
      "info",
      "ice",
      "dtls",
      "rtp",
      "srtp",
      "rtcp",
      "rtx",
      "bwe",
      "score",
      "simulcast",
      "svc",
      "sctp",
    ],
    rtcMinPort: 40_000,
    rtcMaxPort: 40_100,
    disableLiburing: false, // https://github.com/axboe/liburing
  } as MediasoupTypes.WorkerSettings,
  routerMediaCodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: "video",
      mimeType: "video/H264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "42e01f",
        "level-asymmetry-allowed": 1,
      },
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: {},
    },
  ] as MediasoupTypes.RtpCodecCapability[],
};
export default config;
