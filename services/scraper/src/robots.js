/**
 * Lightweight robots.txt check. We do NOT need a full RFC-9309 parser
 * for our use case — we just need to know if our user-agent is
 * disallowed for the path we're about to fetch.
 *
 * If robots.txt is missing, malformed, or unreachable: ASSUME ALLOWED.
 * That's the standard convention; a missing robots is permissive by
 * default. If the site explicitly disallows us, we honor it.
 */

const USER_AGENT = 'CanopyTroveBot/1.0 (+https://canopytrove.com/bot)';

async function isAllowedByRobots(targetUrl) {
  try {
    const url = new URL(targetUrl);
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      // 404, 5xx — assume allowed (standard convention).
      return { allowed: true, reason: `robots.txt returned ${response.status}` };
    }
    const text = await response.text();
    return parseRobots(text, url.pathname);
  } catch (error) {
    return {
      allowed: true,
      reason: `robots.txt fetch failed (assume allowed): ${error.message}`,
    };
  }
}

/**
 * Minimal robots.txt parser. Looks for User-agent: * blocks (or
 * blocks matching CanopyTroveBot) and walks Disallow rules.
 */
function parseRobots(text, requestPath) {
  const lines = text.split(/\r?\n/);
  let inBlock = false;
  const disallows = [];
  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'user-agent') {
      const ua = value.toLowerCase();
      inBlock = ua === '*' || ua.includes('canopytrovebot');
      continue;
    }

    if (!inBlock) continue;

    if (key === 'disallow' && value) {
      disallows.push(value);
    }
  }

  for (const rule of disallows) {
    if (rule === '/') return { allowed: false, reason: 'robots.txt disallows /' };
    if (requestPath.startsWith(rule)) {
      return { allowed: false, reason: `robots.txt disallows ${rule}` };
    }
  }
  return { allowed: true, reason: 'robots.txt allows' };
}

module.exports = { isAllowedByRobots, USER_AGENT };
