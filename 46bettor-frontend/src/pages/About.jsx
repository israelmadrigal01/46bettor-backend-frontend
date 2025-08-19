export default function About() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold">About 46bettor</h1>
      <p className="text-gray-600">
        46bettor tracks model-driven picks with bankroll, ROI, and sport-level splits.
        The dashboard uses a public API for read-only stats, and an admin key (stored
        in your browser) for protected metrics.
      </p>
      <ul className="list-disc pl-6 text-gray-700 space-y-1">
        <li>Live tiles & ledger</li>
        <li>Sport / tags breakdown</li>
        <li>Public endpoints for transparency</li>
      </ul>
      <p className="text-gray-600">Questions? Use the contact form.</p>
    </div>
  );
}
