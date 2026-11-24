import { send } from "../server/http.js";
import { aiEnabled } from "../server/claude.js";
import { hasSharedStore } from "../server/store.js";

export default async function handler(req, res) {
  send(res, 200, { ai: aiEnabled(), sharedCache: hasSharedStore });
}
