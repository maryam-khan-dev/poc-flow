import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { Provider } from "@/app/components/ui/provider";
import { PlayerStoreProvider } from "./components/PlayerStoreProvider";
import Script from "next/script";
const rubik = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${rubik.className}`}>
        <PlayerStoreProvider>
          {" "}
          <Script src="https://open.spotify.com/embed/iframe-api/v1" async />
          <Provider>{children}</Provider>
        </PlayerStoreProvider>
      </body>
    </html>
  );
}