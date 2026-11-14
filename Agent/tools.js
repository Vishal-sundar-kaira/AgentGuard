
const ALLOWED_TOOLS = new Set([
  "get_ticket",
  "update_ticket",
  "delete_ticket",
]);

const BASE_URL = "http://127.0.0.1:3000";

async function callApi(method, path, token, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const responseBody = await response.text();

  let parsedBody = null;
  if (responseBody) {
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      parsedBody = responseBody;
    }
  }

  return {
    status: response.status,
    body: parsedBody,
  };
}

async function executeTool({ name, args, token }) {
  if (!ALLOWED_TOOLS.has(name)) {
    throw new Error(`Tool not allowed: ${name}`);
  }

  if (!args || typeof args.ticketId !== "string") {
    throw new Error("A valid ticketId is required");
  }

  const ticketId = encodeURIComponent(args.ticketId);

  switch (name) {
    case "get_ticket":
      return callApi("GET", `/tickets/${ticketId}`, token);

    case "update_ticket":
      if (!args.title || typeof args.title !== "string") {
        throw new Error("A valid title is required");
      }

      return callApi(
        "PATCH",
        `/tickets/${ticketId}`,
        token,
        { title: args.title }
      );

    case "delete_ticket":
      return callApi("DELETE", `/tickets/${ticketId}`, token);

    default:
      throw new Error(`Unhandled tool: ${name}`);
  }
}

module.exports = { executeTool };
