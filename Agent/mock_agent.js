
const { executeTool } = require("./tools");

function planRequest(message) {
  const text = message.toLowerCase();

  const ticketMatch = text.match(/\bT-\d+\b/i);

  if (!ticketMatch) {
    throw new Error("No ticket ID found in the request");
  }

  const ticketId = ticketMatch[0].toUpperCase();

  if (/\b(delete|remove)\b/.test(text)) {
    return {
      name: "delete_ticket",
      args: { ticketId },
    };
  }

  if (/\b(update|change|rename)\b/.test(text)) {
    const titleMatch = message.match(/\btitle\s+to\s+(.+)$/i);

    if (!titleMatch) {
      throw new Error(
        'For an update, specify a new title, e.g. "change ticket T-202 title to Printer issue"'
      );
    }

    return {
      name: "update_ticket",
      args: {
        ticketId,
        title: titleMatch[1].trim(),
      },
    };
  }

  return {
    name: "get_ticket",
    args: { ticketId },
  };
}

async function runAgent({ message, token }) {
  const plan = planRequest(message);

  const toolResult = await executeTool({
    ...plan,
    token,
  });

  return {
    userMessage: message,
    selectedTool: plan.name,
    toolArguments: plan.args,
    toolResult,
  };
}

module.exports = { runAgent };
