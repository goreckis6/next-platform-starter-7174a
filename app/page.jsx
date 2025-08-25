// app/page.jsx
import Link from "next/link";
import styles from "./page.module.css";
import DropZone from "../components/DropZone"; // ⬅️ dodane

export default function Page() {
  return (
    <main className={styles.container}>
      {/* HERO */}
      <section className={styles.hero}>
        <h1>The most reliable bank statement converter</h1>
        <p className={styles.lead}>
          Convert PDF bank statements from thousands of banks into clean Excel (XLS) and CSV files.
        </p>
        <div className={styles.cta}>
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/dashboard">Try for free</Link>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href="/pricing">See pricing</Link>
        </div>
      </section>

      {/* DROP ZONE – pełna szerokość, 500px wysokości */}
      <section className={styles.dropWrapper}>
        <DropZone />
      </section>

      {/* FEATURES */}
      <section className={styles.features}>
        <div className={styles.card}>
          <h3>Secure</h3>
          <p>We follow strict data-handling practices to keep your files safe during processing.</p>
        </div>
        <div className={styles.card}>
          <h3>Institutional-grade</h3>
          <p>Trusted by accounting, finance and legal teams to process statements at scale.</p>
        </div>
        <div className={styles.card}>
          <h3>Accurate</h3>
          <p>Our extraction improves continuously. If something looks off, tell us and we’ll fix it.</p>
        </div>
      </section>

    {/* FEATURES */}
<section className="bg-white py-16 px-6">
  <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
    <div className="p-6 border rounded-lg shadow-sm bg-white">
      <h3 className="text-xl font-semibold mb-2">Secure</h3>
      <p>
        With years of experience in banking we comply with strict standards when handling your files.
      </p>
    </div>
    <div className="p-6 border rounded-lg shadow-sm bg-white">
      <h3 className="text-xl font-semibold mb-2">Institutional</h3>
      <p>
        We&apos;ve provided our services to thousands of reputable financial, accounting and legal firms.
      </p>
    </div>
    <div className="p-6 border rounded-lg shadow-sm bg-white">
      <h3 className="text-xl font-semibold mb-2">Accurate</h3>
      <p>
        We&apos;re continually improving our algorithms. If a file doesn&apos;t convert to your expectations, email us and we&apos;ll fix it.
      </p>
    </div>
  </div>
</section>

      {/* NEED MORE */}
      <section className={styles.contact}>
        <h2>Need more?</h2>
        <p>We can build bespoke processing for other document formats and custom workflows.</p>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/contact">Contact us</Link>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <nav className={styles.links}>
          <Link href="/api-docs">API Docs</Link>
          <Link href="/about">About</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/blog">Blog</Link>
        </nav>
        <div className={styles.copy}>© {new Date().getFullYear()} Smart Statement</div>
      </footer>
    </main>
  );
}
