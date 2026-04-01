import { serializeError } from "./errors.js";

export function toToolResult(payload) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(payload, null, 2),
    }],
    details: {
      data: payload,
    },
  };
}

export function toToolError(error, extra = {}) {
  return toToolResult({
    ok: false,
    error: serializeError(error),
    ...extra,
  });
}
