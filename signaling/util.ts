import jwksClient from "jwks-rsa";
import jwt, { Algorithm } from "jsonwebtoken";

const client = jwksClient({
  jwksUri: "https://accounts.spotify.com/oidc/certs/v1",
});

function decodeToken(token: string) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded) {
    throw new Error("invalid token - decoding failed");
  }
  const header = decoded.header;
  return {
    header,
  };
}

export async function verifyToken(token: string) {
  const options = {
    ...decodeToken(token),
    algorithms: ["RS256"] as Algorithm[],
  };

  const key = (await client.getSigningKey(options.header.kid)).getPublicKey();

  return jwt.verify(token, key, options);
}
