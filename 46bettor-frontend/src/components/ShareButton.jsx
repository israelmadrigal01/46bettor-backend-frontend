export default function ShareButton({ url }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    } catch {
      prompt("Copy this link:", url);
    }
  };
  return (
    <button
      onClick={copy}
      className="rounded-xl px-3 py-1.5 border hover:bg-gray-50"
      title="Copy share link"
    >
      Share
    </button>
  );
}
