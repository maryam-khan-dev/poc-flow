import mediasoup, { types as MediasoupTypes } from "mediasoup";
import {
  CannotConsumeError,
  WebRtcTransportCreationError,
} from "@/signaling/error";
interface TransportResponse {
  fullTransport: MediasoupTypes.WebRtcTransport;
  clientTransportOptions: Pick<
    MediasoupTypes.WebRtcTransport,
    "id" | "iceCandidates" | "iceParameters" | "dtlsParameters"
  >;
}
export default class Mediasoup {
  constructor() {}
  /**
   * Creates workers with provided settings.
   * @param numWorkers Number of workers to create
   * @param workerSettings Settings to provide mediasoup.createWorker
   * @returns list of created workers
   */
  async createWorkers(
    numWorkers: number,
    workerSettings: MediasoupTypes.WorkerSettings
  ) {
    const workers: Array<MediasoupTypes.Worker> = [];

    for (let i = 0; i < numWorkers; i++) {
      //
      const worker = await mediasoup.createWorker(workerSettings);

      worker.on("died", () => {
        // should NEVER happen
        console.error(
          `Mediasoup worker died, exiting in 2 seconds... ${worker.pid}`
        );
        setTimeout(() => process.exit(1), 2000);
      });

      workers.push(worker);

      /*
                  setInterval(async () => {
                      const usage = await worker.getResourceUsage();
                      console.info('mediasoup Worker resource usage', { worker_pid: worker.pid, usage: usage });
                      const dump = await worker.dump();
                      console.info('mediasoup Worker dump', { worker_pid: worker.pid, dump: dump });
                  }, 120000);
                  */
      return workers;
    }
  }
  /**
   * Gets the next Mediasoup worker, distributing the load in round-robin fashion.
   * @param workers - List of current workers
   * @param nextMediasoupWorkerIdx - Next Mediasoup worker index
   * @returns Array containing next worker and updated value of nextMediasoupWorkerIdx
   */
  async getNextMediasoupWorker(
    workers: Array<MediasoupTypes.Worker>,
    nextMediasoupWorkerIdx: number
  ) {
    const worker = workers[nextMediasoupWorkerIdx];
    if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;
    return [worker, nextMediasoupWorkerIdx];
  }

  /**
   * Creates a router for a given worker
   * @param worker - The worker that needs to have a router created in it
   * @param mediaCodecs - The media codecs set in the configuration
   * @param roomId - the PartyKit room ID
   * @returns The created router
   */
  async createRouter(
    worker: MediasoupTypes.Worker,
    mediaCodecs: MediasoupTypes.RtpCodecCapability[],
    roomId: string
  ) {
    const router = await worker.createRouter({ mediaCodecs });
    router.observer.on("close", () => {
      console.log(
        "---------------> Router is now closed as the last peer has left the room.",
        {
          roomId,
        }
      );
    });
    return router;
  }

  /**
   * Gets router's RTP capabilities.
   * @param router The router whose RTP capabilities are requested.
   * @returns Router's RTP capabalities.
   */
  getRouterRtpCapabilities(router: MediasoupTypes.Router) {
    return router.rtpCapabilities;
  }

  /**
   * Closes given router.
   * @param router The router to close.
   */
  closeRouter(router: MediasoupTypes.Router) {
    router.close();
    console.log("Closed router", {
      routerId: router.id,
      routerClosed: router.closed,
    });
  }

  /**
   * Create a WebRTC transport.
   * @param router The router to create transport on
   * @param webRtcTransportOptions The options for configuring transport
   * @param connectionId The connection ID associated with this event in signaling server
   * @param userId The user ID associated with this event in signaling server
   * @returns Created transport
   */
  async createWebRtcTransport(
    router: MediasoupTypes.Router,
    webRtcTransportOptions: MediasoupTypes.WebRtcTransportOptions,
    connectionId: string,
    userId: string
  ) {
    console.log("webRtcTransportOptions ----->", webRtcTransportOptions);
    // TODO: set userId as value of sub in access token on first post-connect message
    const transport = await router.createWebRtcTransport(
      webRtcTransportOptions
    );
    if (!transport) {
      throw new WebRtcTransportCreationError(
        connectionId,
        userId,
        webRtcTransportOptions
      );
    }
    const {
      id: transportId,
      type,
      iceParameters,
      iceCandidates,
      dtlsParameters,
    } = transport;
    console.log("Transport created", { transportId, transportType: type });

    transport.on("icestatechange", (iceState: MediasoupTypes.IceState) => {
      if (iceState === "disconnected" || iceState === "closed") {
        console.log('Transport closed "icestatechange" event', {
          connectionId,
          userId,
          transportId,
          iceState,
        });
        transport.close();
      }
    });

    transport.on("sctpstatechange", (sctpState: MediasoupTypes.sctpState) => {
      console.log('Transport "sctpstatechange" event', {
        connectionId,
        userId,
        transportId,
        sctpState,
      });
    });

    transport.on("dtlsstatechange", (dtlsState: MediasoupTypes.DtlsState) => {
      if (dtlsState === "failed" || dtlsState === "closed") {
        console.log('Transport closed "dtlsstatechange" event', {
          connectionId,
          userId,
          transportId,
          dtlsState,
        });
        transport.close();
      }
    });

    transport.observer.on("close", () => {
      console.log("Transport closed", { connectionId, userId, transportId });
    });

    return {
      fullTransport: transport,
      clientTransportOptions: {
        id: transportId,
        iceParameters,
        iceCandidates,
        dtlsParameters,
      },
    } as TransportResponse;
  }

  /**
   * Establishes secure connection using the DTLS parameters passed by client.
   * @param transport The transport to trigger "connect" event  on.
   * @param dtlsParameters Client-sent DTLS parameters for configuring connection.
   * @param userId The user ID associated with this connection.
   */
  async connectTransport(
    transport: MediasoupTypes.Transport,
    dtlsParameters: MediasoupTypes.DtlsParameters,
    userId: string
  ) {
    await transport.connect({ dtlsParameters });
    console.log("Connect transport", { userId, transportId: transport.id });
  }

  /**
   * Restarts the ICE layer by generating new local ICE parameters that must be signaled to the remote endpoint.
   * @param transport Transport whose ICE parameters need to be regenerated.
   * @returns New ICE parameters.
   */
  async restartIceLayer(transport: MediasoupTypes.WebRtcTransport) {
    const iceParameters = await transport.restartIce();
    return iceParameters;
  }

  /**
   * Closes the provided transport.
   * @param transport The transport to close.
   * @param userId The user ID associated with the signaling server connection.
   */
  closeTransport(transport: MediasoupTypes.WebRtcTransport, userId: string) {
    transport.close();

    console.log(`Transport closed`, {
      transportId: transport.id,
      userId,
      closed: transport.closed,
    });
    // TODO: use this to loop through transports for peer and close them all, then close router if room is empty
  }

  /**
   * Creates a producer on the given transport.
   * @param producerTransport The WebRtc Transport that the producer should be created on
   * @param producerOptions Relevant options for configuring producer
   * @param userId The user ID associated with the connection in signaling server
   * @returns Created producer
   */
  async createProducer(
    producerTransport: MediasoupTypes.WebRtcTransport,
    producerOptions: MediasoupTypes.ProducerOptions,
    userId: string
  ) {
    const producer = await producerTransport.produce(producerOptions);
    const { id, type, kind } = producer;
    console.log("Producer ----->", { type, kind });
    producer.on("transportclose", () => {
      console.log('Producer "transportclose" event', {
        id,
        userId,
        type,
        kind,
      });
      this.closeSource(producer, userId, "producer");
    });
    return producer;
  }

  /**
   * Creates a consumer on the given transport.
   * @param consumerTransport The WebRtc Transport that the consumer should be created on
   * @param consumerOptions Relevant options for configuring consumer
   * @param userId The user ID associated with the connection in signaling server
   * @returns Created consumer
   */
  async createConsumer(
    router: MediasoupTypes.Router,
    consumerTransport: MediasoupTypes.WebRtcTransport,
    consumerOptions: MediasoupTypes.ConsumerOptions,
    userId: string
  ) {
    if (
      !router.canConsume({
        producerId: consumerOptions.producerId,
        rtpCapabilities: consumerOptions.rtpCapabilities,
      })
    ) {
      throw new CannotConsumeError(
        consumerOptions.producerId,
        consumerTransport.id,
        userId
      );
    }
    const consumer = await consumerTransport.consume(consumerOptions);
    const { id, type, kind } = consumer;
    console.log("Consumer ----->", { type, kind });
    consumer.on("transportclose", () => {
      console.log('Consumer "transportclose" event', {
        id,
        userId,
        type,
        kind,
      });
      this.closeSource(consumer, userId, "consumer");
    });
    return consumer;
  }

  /**
   * Pauses the given source.
   * @param source The source to be paused.
   * @param type The type of source - "consumer" or "producer"
   * @param userId The user ID associated with signaling server connection.
   */
  async pauseSource(
    source: MediasoupTypes.Consumer | MediasoupTypes.Producer,
    userId: string,
    type: "consumer" | "producer"
  ) {
    await source.pause();
    console.log(`${type} paused`, {
      userId,
      [`${type}Id`]: source.id,
      paused: source.paused,
    });
  }

  /**
   * Resumes the given source.
   * @param source The source to be resumed.
   * @param userId The user ID associated with signaling server connection.
   * @param type The type of source - "consumer" or "producer"
   */
  async resumeSource(
    source: MediasoupTypes.Consumer | MediasoupTypes.Producer,
    userId: string,
    type: "consumer" | "producer"
  ) {
    await source.resume();
    console.log(`${type} resumed`, {
      userId,
      [`${type}Id`]: source.id,
      paused: source.paused,
    });
  }

  /**
   * Closes the provided source.
   * @param source The source to close.
   * @param type The type of source - "consumer" or "producer"
   * @param userId The user ID associated with the signaling server connection.
   */
  closeSource(
    source: MediasoupTypes.Consumer | MediasoupTypes.Producer,
    userId: string,
    type: "consumer" | "producer"
  ) {
    source.close();

    console.log(`${type} closed`, {
      [`${type}Id`]: source.id,
      userId,
      kind: source.kind,
      appData: source.appData,
      closed: source.closed,
    });
  }
}
