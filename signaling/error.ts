import { SigningKey } from "jwks-rsa";
import { types as MediasoupTypes } from "mediasoup";
/**
 * Custom error for when router cannot consume data due to incompatible RTP capabilities.
 */
export class CannotConsumeError extends Error {
  public readonly producerId: string;
  public readonly transportId: string;
  public readonly userId: string;
  constructor(
    producerId: string,
    transportId: string,
    userId: string,
    description?: string
  ) {
    super(description ?? "Router cannot consume data");
    this.producerId = producerId;
    this.transportId = transportId;
    this.userId = userId;
    Error.captureStackTrace(this, this.constructor);
  }
}
/**
 * Custom error for when WebRTC Transport creation failed.
 */
export class WebRtcTransportCreationError extends Error {
  public readonly connectionId: string;
  public readonly userId: string;
  public readonly webRtcTransportOptions: MediasoupTypes.WebRtcTransportOptions;
  constructor(
    connectionId: string,
    userId: string,
    webRtcTransportOptions: MediasoupTypes.WebRtcTransportOptions,
    description?: string
  ) {
    super(description ?? "WebRTCTransport creation failed.");
    this.connectionId = connectionId;
    this.userId = userId;
    this.webRtcTransportOptions = webRtcTransportOptions;
    Error.captureStackTrace(this, this.constructor);
  }
}
export class JwtPublicKeyFetchError extends Error {
  public readonly key: SigningKey | undefined;
  public readonly err: Error | null;
  constructor(err: Error | null, key?: SigningKey, description?: string) {
    super(description ?? "Failed to fetch public key");
    this.key = key;
    this.err = err;
    Error.captureStackTrace(this, this.constructor);
  }
}
