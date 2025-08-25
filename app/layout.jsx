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
        <link rel="icon" href="/favicon.svg" sizes="any" />
      </head>
      <body className="antialiased bg-white text-black">
        {/* HEADER na pełną szerokość */}
        <Header />

        {/* Treść strony w węższym kontenerze */}
        <div className="flex flex-col min-h-screen px-6 sm:px-12">
          <main className="flex flex-col w-full max-w-5xl mx-auto grow">
            {children}
          </main>
        </div>

        {/* FOOTER na pełną szerokość */}
        <Footer />
      </body>
    </html>
  );
}
