export default function Contact() {
  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Contact</h1>
      <form name="contact" method="POST" data-netlify="true" action="/thanks" className="space-y-4">
        <input type="hidden" name="form-name" value="contact" />
        <label className="block">
          <span className="text-sm text-gray-700">Name</span>
          <input name="name" required className="mt-1 w-full rounded-xl border p-3" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <input name="email" type="email" required className="mt-1 w-full rounded-xl border p-3" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Message</span>
          <textarea name="message" rows="5" required className="mt-1 w-full rounded-xl border p-3" />
        </label>
        <button className="rounded-2xl px-5 py-2.5 bg-black text-white">Send</button>
      </form>
      <p className="text-sm text-gray-500 mt-3">
        After you submit, messages appear in Netlify → Forms.
      </p>
    </div>
  );
}
