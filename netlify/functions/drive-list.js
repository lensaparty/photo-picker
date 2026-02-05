const DRIVE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyFbemDNLsOib5BGbIzE1b_a8-kQmCSjs-sbhQqzpkVfYJMnnAubmWTPPMJ08Apk89G3A/exec";

exports.handler = async (event) => {
  const folderId = event.queryStringParameters?.folderId;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (!folderId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ files: [], error: "Missing folderId" }),
    };
  }

  try {
    const url = `${DRIVE_ENDPOINT}?folderId=${encodeURIComponent(folderId)}`;
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ files: [], error: body.slice(0, 200) }),
      };
    }
    return { statusCode: 200, headers, body };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ files: [], error: error.message }),
    };
  }
};
