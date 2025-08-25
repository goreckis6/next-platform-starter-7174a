import Link from "next/link";

export default function Page() {
  return (
    <main style={{maxWidth:960,margin:"40px auto",padding:"0 16px"}}>
      <h1>Smart Statement</h1>
      <p>Convert bank statements to clean spreadsheets and get insights.</p>
      <p>
        <Link href="/dashboard">Try now</Link> ·{" "}
        <Link href="/pricing">See pricing</Link>
      </p>
    </main>
  );
}
