// components/Home.jsx
"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      {/* HERO */}
      <section className="hero">
        <h1>The most reliable bank statement converter</h1>
        <p className="lead">
          Convert PDF bank statements from thousands of banks into clean Excel (XLS) and CSV files.
        </p>
        <div className="cta">
          <Link className="btn btn-primary" href="/dashboard">Try for free</Link>
          <Link className="btn btn-ghost" href="/pricing">See pricing</Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features">
        <div className="card">
          <h3>Secure</h3>
          <p>
            We follow strict data-handling practices to keep your files safe during processing.
          </p>
        </div>
        <div className="card">
          <h3>Institutional-grade</h3>
          <p>
            Trusted by accounting, finance and legal teams to process statements at scale.
          </p>
        </div>
        <div className="card">
          <h3>Accurate</h3>
          <p>
            Our extraction improves continuously. If something looks off, tell us and we’ll fix it.
          </p>
        </div>
      </section>

      {/* FREEMIUM TIERS */}
      <section className="tiers">
        <div className="tier">
          <h2>Anonymous</h2>
          <p className="muted">No sign-up required</p>
          <ul>
            <li>1 page every 24 hours</li>
          </ul>
          <div className="price">Free</div>
          <Link className="btn btn-primary" href="/dashboard">Convert now</Link>
        </div>

        <div className="tier">
          <h2>Registered</h2>
          <p className="muted">Registration is free</p>
          <ul>
            <li>5 pages every 24 hours</li>
          </ul>
          <div className="price">Free</div>
          <Link className="btn btn-primary" href="/login">Create account</Link>
        </div>

        <div className="tier">
          <h2>Subscribe</h2>
          <p className="muted">Convert more documents with higher limits</p>
          <ul>
            <li>Starter / Professional / Business plans</li>
          </ul>
          <div className="price">From $15 / month</div>
          <Link className="btn btn-ghost" href="/pricing">See plans</Link>
        </div>
      </section>

      {/* NEED MORE */}
      <section className="contact">
        <h2>Need more?</h2>
        <p>
          We can build bespoke processing for other document formats and custom workflows.
        </p>
        <Link className="btn btn-primary" href="/contact">Contact us</Link>
      </section>

      {/* FOOTER (prosty) */}
      <footer className="footer">
        <nav className="links">
          <Link href="/api-docs">API Docs</Link>
          <Link href="/about">About</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/blog">Blog</Link>
        </nav>
        <div className="copy">© {new Date().getFullYear()} Smart Statement</div>
      </footer>

      {/* Minimal styles (styled-jsx) */}
      <style jsx>{`
        .container {
          max-width: 960px;
          margin: 0 auto;
          padding: 40px 16px 80px;
        }
        .hero {
          text-align: center;
          margin-bottom: 56px;
        }
        h1 {
          font-size: 40px;
          line-height: 1.1;
          margin: 0 0 12px;
        }
        .lead {
          font-size: 18px;
          color: #475569;
          margin: 0 auto 20px;
          max-width: 700px;
        }
        .cta {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .features {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 16px;
          margin: 40px 0 56px;
        }
        @media (min-width: 768px) {
          .features {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .card {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .card h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }
        .card p {
          margin: 0;
          color: #475569;
        }

        .tiers {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 56px;
        }
        @media (min-width: 900px) {
          .tiers {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .tier {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 24px;
          background: #fff;
          text-align: center;
        }
        .tier h2 {
          margin: 0 0 4px;
        }
        .muted {
          color: #64748b;
          margin-bottom: 12px;
        }
        .tier ul {
          list-style: none;
          padding: 0;
          margin: 0 0 8px;
        }
        .tier li {
          margin: 4px 0;
        }
        .price {
          font-weight: 600;
          margin: 8px 0 16px;
        }

        .contact {
          text-align: center;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 28px;
          background: #f8fafc;
          margin-bottom: 40px;
        }

        .footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
          display: grid;
          gap: 12px;
          justify-items: center;
        }
        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 16px;
          justify-content: center;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border-radius: 12px;
          border: 1px solid transparent;
          font-weight: 600;
          text-decoration: none;
        }
        .btn-primary {
          background: #0f172a;
          color: #fff;
        }
        .btn-primary:hover {
          background: #111827;
        }
        .btn-ghost {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #e2e8f0;
        }
        .btn-ghost:hover {
          background: #e2e8f0;
        }
      `}</style>
    </main>
  );
}
