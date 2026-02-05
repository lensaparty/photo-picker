const DRIVE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyGxjzwUcW-KxKm0M5pbR1kpkViqyzBWL76T4PRzppHX5ntF5BtpRyII8T3GZlK2ulplA/exec";

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
