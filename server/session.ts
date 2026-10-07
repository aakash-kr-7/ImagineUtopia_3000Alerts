import { sha256 } from "../core/contracts";
/** A random HttpOnly capability isolates anonymous browser workspaces. No shared guest owner. */
export async function workspaceIdentity(request: Request) {
  const signed = request.headers.get("oai-authenticated-user-id");
  if (signed)
    return {
      owner: "user:" + (await sha256(signed)),
      setCookie: null,
      mode: "signed-in",
    };
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("utopia_session="))
    ?.slice(15);
  const valid = token && /^[a-f0-9]{64}$/.test(token);
  const value = valid
    ? token
    : Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
  return {
    owner: "guest:" + (await sha256(value)),
    mode: "private-browser",
    setCookie: valid
      ? null
      : `utopia_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
  };
}
