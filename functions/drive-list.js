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
    return new Response(body, { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ files: [], error: error.message }), {
      status: 500,
      headers,
    });
  }
}
