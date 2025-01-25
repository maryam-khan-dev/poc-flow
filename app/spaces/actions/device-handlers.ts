import { types as MediasoupClientTypes } from "mediasoup-client";
import type { Except } from "type-fest";
import { ProducerEventHandlers } from "@/app/spaces/join/setup/page";
import { TransportHandlers } from "@/app/spaces/components/TransportsManager";
export type TransportConnectionEventHandlers = Partial<
  Record<
    MediasoupClientTypes.ConnectionState,
    (transport: MediasoupClientTypes.Transport) => void
  >
>;
export type ConnectionEventHandlers = {
  producerTransport: TransportConnectionEventHandlers;
  consumerTransport: TransportConnectionEventHandlers;
};

const transportConnectionEventHandlers: TransportConnectionEventHandlers = {
  connecting: (transport: MediasoupClientTypes.Transport) => {
    console.log("Producer Transport connecting...", {
      id: transport.id,
    });
  },
  connected: (transport: MediasoupClientTypes.Transport) => {
    console.log("Producer Transport connected", {
      id: transport.id,
    });
  },
  disconnected: (transport: MediasoupClientTypes.Transport) => {
    console.log("Producer Transport disconnected", {
      id: transport.id,
    });
  },
  failed: (transport: MediasoupClientTypes.Transport) => {
    console.warn("Producer Transport failed", {
      id: transport.id,
    });
    transport.close();
  },
} as const;

export async function loadDevice(
  device: MediasoupClientTypes.Device,
  routerRtpCapabilities: MediasoupClientTypes.RtpCapabilities
) {
  try {
    await device.load({
      routerRtpCapabilities: routerRtpCapabilities,
    });
    console.log("Device loaded", device);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}
export function createSendTransport(
  device: MediasoupClientTypes.Device,
  transportOptions: MediasoupClientTypes.TransportOptions,
  additionalHandlers: TransportHandlers
) {
  const producerTransport = device.createSendTransport(transportOptions);

  console.info("07.4 producerTransportData ---->", {
    producerTransportId: producerTransport.id,
    producerTransportData: transportOptions,
  });

  producerTransport.on(
    "connect",
    async ({ dtlsParameters }, callback, errback) => {
      try {
        await additionalHandlers.connect(producerTransport.id, dtlsParameters);
        callback();
      } catch (err) {
        console.error("Error in connect", err);
        errback(err as unknown as Error);
      }
    }
  );
  producerTransport.on(
    "produce",
    ({ kind, appData, rtpParameters }, callback, errback) => {
      console.log(
        "producerTransport.on('produce') event: ",
        kind,
        appData,
        producerTransport.id
      );
      additionalHandlers.produce(
        producerTransport.id,
        { kind, appData, rtpParameters },
        callback,
        errback
      );
    }
  );

  producerTransport.on(
    "connectionstatechange",
    (state: MediasoupClientTypes.ConnectionState) => {
      additionalHandlers.connectionstatechange(state, producerTransport);
      transportConnectionEventHandlers[state]?.(producerTransport);
    }
  );

  producerTransport.on("icegatheringstatechange", (state) => {
    console.log("Producer transport icegatheringstatechange", {
      state: state,
      id: producerTransport.id,
    });
  });
  return producerTransport;
}

export function createRecvTransport(
  device: MediasoupClientTypes.Device,
  transportOptions: MediasoupClientTypes.TransportOptions,
  additionalHandlers: Except<TransportHandlers, "produce">
) {
  const consumerTransport = device.createRecvTransport(transportOptions);
  consumerTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
    additionalHandlers.connect(consumerTransport.id, dtlsParameters);
  });

  consumerTransport.on(
    "connectionstatechange",
    (state: MediasoupClientTypes.ConnectionState) => {
      additionalHandlers.connectionstatechange(state, consumerTransport);
      transportConnectionEventHandlers[state]?.(consumerTransport);
    }
  );

  consumerTransport.on("icegatheringstatechange", (state) => {
    console.log("Consumer icegatheringstatechange", {
      state: state,
      id: consumerTransport.id,
    });
  });
  return consumerTransport;
}
export async function getUserMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    return { ok: true, stream };
  } catch (e) {
    console.log("Error getting user media", e);
    return { ok: false, error: "We couldn't get your camera and mic." };
  }
}
export async function produce(
  device: MediasoupClientTypes.Device,
  producerTransport: MediasoupClientTypes.Transport,
  producerEventHandlers: ProducerEventHandlers,
  stream: MediaStream
) {
  if (!device.canProduce("video") && !device.canProduce("audio")) {
    console.error("Device can't produce audio or video");
    return { ok: false, error: "Your devices can't produce audio or video." };
  }
  try {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    const videoProducer = await producerTransport.produce({
      track: videoTrack,
      appData: {
        streamId: stream.id,
        deviceId: videoTrack.id,
        deviceLabel: videoTrack.label,
      },
    });
    const audioProducer = await producerTransport.produce({
      track: audioTrack,
      appData: {
        streamId: stream.id,
        deviceId: audioTrack.id,
        deviceLabel: audioTrack.label,
      },
    });
    console.log("Created producers", videoProducer);
    [videoProducer, audioProducer].forEach((producer) => {
      producer.on("trackended", () => {
        console.log("Track ended");
        producerEventHandlers["trackended"]?.(producer.id);
      });
      producer.on("transportclose", () => {
        console.log("Transport closed");
        producerEventHandlers["transportclose"]?.(producer.id);
      });
      producer.on("@close", () => {
        console.log("Producer closed");
        producerEventHandlers["close"]?.(producer.id);
      });
    });

    return {
      ok: true,
      stream,
      producers: { video: videoProducer, audio: audioProducer },
    };
  } catch (e) {
    console.log("Error getting user media", e);
    return { ok: false, error: "We couldn't get your camera and mic." };
  }
}
export async function hasGrantedPermissions() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.some((device) => device.label !== "");
}
export function getVideoConstraints(deviceId: string) {
  const videoBaseConstraints = (
    width: number,
    height: number,
    exact = false
  ) => ({
    audio: false,
    video: {
      width: exact ? { exact: width } : { ideal: width },
      height: exact ? { exact: height } : { ideal: height },
      deviceId: deviceId,
      aspectRatio: 1.777, // 16:9 aspect ratio
      frameRate: { ideal: 30 },
    },
  });

  // const videoResolutionMap = {
  //     qvga: { width: 320, height: 240, exact: true },
  //     vga: { width: 640, height: 480, exact: true },
  //     hd: { width: 1280, height: 720, exact: true },
  //     fhd: { width: 1920, height: 1080, exact: true },
  //     '2k': { width: 2560, height: 1440, exact: true },
  //     '4k': { width: 3840, height: 2160, exact: true },
  //     '6k': { width: 6144, height: 3456, exact: true },
  //     '8k': { width: 7680, height: 4320, exact: true },
  // };

  return videoBaseConstraints(1280, 720);
}
export function getAudioConstraints(deviceId: string) {
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      deviceId: deviceId,
    },
    video: false,
  };
  return constraints;
}
