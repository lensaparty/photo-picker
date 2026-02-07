const DRIVE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyFbemDNLsOib5BGbIzE1b_a8-kQmCSjs-sbhQqzpkVfYJMnnAubmWTPPMJ08Apk89G3A/exec";

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const folderId = url.searchParams.get("folderId");
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  if (!folderId) {
    return new Response(JSON.stringify({ files: [], error: "Missing folderId" }), {
      status: 400,
      headers,
    });
  }

  try {
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    const res = await fetch(
      `${DRIVE_ENDPOINT}?folderId=${encodeURIComponent(folderId)}`
    );
    const body = await res.text();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ files: [], error: body.slice(0, 200) }),
        { status: res.status, headers }
      );
    }
    const response = new Response(body, {
      status: 200,
      headers: {
        ...headers,
        "Cache-Control": "public, max-age=600, s-maxage=3600",
      },
    });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    return new Response(JSON.stringify({ files: [], error: error.message }), {
      status: 500,
      headers,
    });
  }
}
