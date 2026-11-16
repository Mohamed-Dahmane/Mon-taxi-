const endpoint = Deno.env.get("SUPABASE_URL") + "/rest/v1/";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey };
const jsonHeaders = { ...headers, "Content-Type": "application/json", Prefer: "return=representation" };

Deno.serve(async (request) => {
  if (!["GET", "POST"].includes(request.method)) return new Response(null, { status: 405 });
  const token = request.headers.get("X-Taxi-Directory-Key") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response(null, { status: 401 });
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const digest = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  try {
    const auth = await fetch(endpoint + "taxi_directory_publisher?select=user_id&token_hash=eq." + digest, { headers });
    if (!auth.ok) throw Error("Publisher unavailable");
    const [publisher] = await auth.json();
    if (!publisher) return new Response(null, { status: 401 });

    if (request.method === "GET") {
      const userFilter = "&user_id=eq." + publisher.user_id;
      const [feedResponse, taxiResponse] = await Promise.all([
        fetch(endpoint + "taxi_directory_feed?select=revision" + userFilter, { headers }),
        fetch(endpoint + "taxi_hotel_sync?select=directory:snapshot->directory" + userFilter, { headers })
      ]);
      if (!feedResponse.ok || !taxiResponse.ok) throw Error("Directory unavailable");
      const [feed] = await feedResponse.json();
      const [taxi] = await taxiResponse.json();
      return Response.json({ revision: feed?.revision ?? null, directory: taxi?.directory ?? null }, {
        headers: { "Cache-Control": "private, no-store" }
      });
    }

    const raw = await request.text();
    if (raw.length > 1_000_000) return new Response(null, { status: 413 });
    const { revision, payload } = JSON.parse(raw);
    if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(payload?.hotels) || !Array.isArray(payload?.drivers)) {
      return new Response(null, { status: 400 });
    }
    const userId = publisher.user_id;
    const now = await fetch(endpoint + "taxi_directory_feed?select=revision&user_id=eq." + userId, { headers });
    if (!now.ok) throw Error("Directory unavailable");
    const [current] = await now.json();
    if (current && current.revision >= revision) return new Response(null, { status: 204 });
    const next = { user_id: userId, revision, payload };
    const update = await fetch(endpoint + "taxi_directory_feed" +
      (current ? "?user_id=eq." + userId + "&revision=lt." + revision : ""),
      { method: current ? "PATCH" : "POST", headers: jsonHeaders, body: JSON.stringify(next) });
    if (update.status === 409) return new Response(null, { status: 409 });
    if (!update.ok) throw Error("Directory could not be saved");
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
});
