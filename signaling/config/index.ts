import type { types as MediasoupTypes } from "mediasoup";
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
  // WebRtcTransportOptions
  webRtcTransport: {
    listenInfos: [
      // { protocol: 'udp', ip: IPv4, portRange: { min: 40000, max: 40100 } },
      // { protocol: 'tcp', ip: IPv4, portRange: { min: 40000, max: 40100 } },
      {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedAddress: process.env.ANNOUNCED_ADDRESS,
        portRange: { min: 40000, max: 40100 },
      },
      {
        protocol: "tcp",
        ip: "0.0.0.0",
        announcedAddress: process.env.ANNOUNCED_ADDRESS,
        portRange: { min: 40000, max: 40100 },
      },
    ],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1500000,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    iceConsentTimeout: 20,
  } as MediasoupTypes.WebRtcTransportOptions,
};
export default config;
