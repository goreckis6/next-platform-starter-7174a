// app/page.jsx
import Link from "next/link";
import styles from "./page.module.css";

export default function Page() {
  return (
    <main className={styles.container}>
      {/* HERO */}
      <section className={styles.hero}>
        <h1 className={styles.title}>The most reliable bank statement converter</h1>
        <p className={styles.lead}>
          Convert PDF bank statements from thousands of banks into clean Excel (XLS) and CSV files.
        </p>
        <div className={styles.cta}>
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/dashboard">Try for free</Link>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href="/pricing">See pricing</Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.features}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Secure</h3>
          <p className={styles.cardText}>
            We follow strict data-handling practices to keep your files safe during processing.
          </p>
        </div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Institutional-grade</h3>
          <p className={styles.cardText}>
            Trusted by accounting, finance and legal teams to process statements at scale.
          </p>
        </div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Accurate</h3>
          <p className={styles.cardText}>
            Our extraction improves continuously. If something looks off, tell us and we’ll fix it.
          </p>
        </div>
      </section>

      {/* FREEMIUM TIERS */}
      <section className={styles.tiers}>
        <div className={styles.tier}>
          <h2 className={styles.tierTitle}>Anonymous</h2>
          <p className={styles.muted}>No sign-up required</p>
          <ul className={styles.tierList}>
            <li className={styles.tierItem}>1 page every 24 hours</li>
          </ul>
          <div className={styles.price}>Free</div>
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/dashboard">Convert now</Link>
        </div>

        <div className={styles.tier}>
          <h2 className={styles.tierTitle}>Registered</h2>
          <p className={styles.muted}>Registration is free</p>
          <ul className={styles.tierList}>
            <li className={styles.tierItem}>5 pages every 24 hours</li>
          </ul>
          <div className={styles.price}>Free</div>
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/login">Create account</Link>
        </div>

        <div className={styles.tier}>
          <h2 className={styles.tierTitle}>Subscribe</h2>
          <p className={styles.muted}>Convert more documents with higher limits</p>
          <ul className={styles.tierList}>
            <li className={styles.tierItem}>Starter / Professional / Business plans</li>
          </ul>
          <div className={styles.price}>From $15 / month</div>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href="/pricing">See plans</Link>
        </div>
      </section>

      {/* NEED MORE */}
      <section className={styles.contact}>
        <h2 className={styles.sectionTitle}>Need more?</h2>
        <p className={styles.sectionText}>
          We can build bespoke processing for other document formats and custom workflows.
        </p>
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
