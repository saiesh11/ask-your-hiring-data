import Link from "next/link";

export default function LandingPage() {
  return (
    <main style={{ maxWidth: 640, margin: "6rem auto", padding: "0 1.25rem" }}>
      <h1>Ask Your Hiring Data</h1>
      <p style={{ color: "var(--dim)" }}>
        A read-only, natural-language analytics assistant over your hiring data. Ask a plain
        question; a schema-validated query IR and a deterministic executor return a grounded,
        role-scoped answer.
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/signup">Create a workspace</Link>
        {" · "}
        <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
