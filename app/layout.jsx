import "../styles/globals.css";
import { Footer } from "../components/footer";
import { Header } from "../components/header";

export const metadata = {
  title: {
    template: "%s | Netlify",
    default: "Netlify Starter",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link relName="icon" href="/favicon.svg" sizes="any" />
      </head>
      {/* zmiana: białe tło + czarny tekst */}
      <body className="antialiased bg-white text-black">
        {/* usuwamy bg-noise, zostawiamy neutralny wrapper */}
        <div className="flex flex-col min-h-screen px-6 sm:px-12">
          <div className="flex flex-col w-full max-w-5xl mx-auto grow">
            <Header />
            <main className="grow">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
