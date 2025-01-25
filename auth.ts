import NextAuth from "next-auth";
import Spotify, { SpotifyProfile } from "next-auth/providers/spotify";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Spotify({
      authorization:
        "https://accounts.spotify.com/authorize?scope=user-read-email%20user-library-read%20playlist-read-private%20user-read-private",
      async profile(profile: SpotifyProfile, tokens) {
        return {
          id: profile.id,
          name: profile.display_name,
          email: profile.email,
          image: profile.images?.[0]?.url,
          token: tokens?.access_token,
        };
      },
    }),
  ],
  callbacks: {
    // based on guide: https://authjs.dev/guides/integrating-third-party-backends#storing-the-token-in-the-session
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: token.accessToken ?? account.access_token,
          refreshToken: token.refreshToken ?? account.refresh_token,
          expiresAt: token.expiresAt ?? account.expires_at,
        };
      }
      let accessToken = token.accessToken;
      let refreshToken = token.refreshToken;
      const expiresAt = !!token.expiresAt
        ? (token.expiresAt as number) * 1000
        : Date.now();
      if (expiresAt <= Date.now()) {
        // refresh token rotation guide: https://authjs.dev/guides/refresh-token-rotation
        if (!refreshToken) throw new TypeError("Missing refresh_token");
        try {
          console.log("Trying to refresh with ", refreshToken);
          const response = await fetch(
            "https://accounts.spotify.com/api/token",
            {
              method: "POST",
              body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken as string,
                client_id: process.env.AUTH_SPOTIFY_ID!,
              }),
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(
                  `${process.env.AUTH_SPOTIFY_ID!}:${
                    process.env.AUTH_SPOTIFY_SECRET
                  }`
                )}`,
              },
            }
          );

          const tokensOrError = await response.json();
          if (!response.ok)
            throw new Error("An error happened", { cause: tokensOrError });
          let expiresIn = 0;
          ({
            access_token: accessToken,
            expires_in: expiresIn,
            refresh_token: refreshToken,
          } = tokensOrError as {
            access_token: string;
            expires_in: number;
            refresh_token?: string;
          });
          token = {
            ...token,
            expiresAt: Math.floor(Date.now() / 1000 + expiresIn),
            accessToken,
            refreshToken: refreshToken ?? token.refreshToken, // reset to original if null
          };
        } catch (error) {
          console.error("ERROR refreshing access_token", error);
          token.error = "RefreshTokenError";
          return token;
        }
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: session.accessToken ?? token.accessToken,
      };
    },
  },
  pages: {
    signIn: "/",
  },
});
