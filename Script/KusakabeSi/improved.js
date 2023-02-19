const reverse = {
  "uwiki.kskb.eu.org": {
    // Domain of the Cloudflare worker
    protocol: "https", // HTTP or HTTPS, protocol of the original site
    host: "en.wikipedia.org", // Target domain
    replace: {
      //Replace string for all JSON/HTML/TEXT/Javascript through this proxy
      Wiki: "Uncyclo",
    },
    reverse: {
      // Additional reverse proxy for custom resources, such as pictures
      "/static/images/project-logos/enwiki.png":
        "https://images.uncyclomedia.co/uncyclopedia/en/b/bc/Wiki.png",
    },
    redirect: {}, // 302 redirection
  },
};

addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  let target = null;

  for (const [sDomain, sTarget] of Object.entries(reverse)) {
    if (url.host.endsWith(sDomain)) {
      target = sTarget;
      target.f_host = sDomain;
      break;
    }
  }

  if (!target) {
    return event.respondWith(new Response("Not found", { status: 404 }));
  }

  url.protocol = target.protocol;
  url.host = target.host;

  if (url.pathname in target.redirect) {
    return event.respondWith(
      Response.redirect(target.redirect[url.pathname], 302)
    );
  }

  if (url.pathname in target.reverse) {
    const reverseTarget = target.reverse[url.pathname];

    if (reverseTarget.startsWith("http")) {
      url = new URL(reverseTarget);
    } else {
      url.pathname = reverseTarget;
    }
  }

  if (target.path_prefix) {
    url.pathname = target.path_prefix + url.pathname;
  }

  const modifiedRequest = new Request(url, {
    body: request.body,
    headers: request.headers,
    method: request.method,
  });

  event.passThroughOnException();
  return event.respondWith(handleRequest(modifiedRequest, target));
});

async function handleRequest(request, target) {
  const response = await fetch(request);

  const contentType = response.headers.get("Content-Type");
  if (
    contentType &&
    (contentType.includes("json") ||
      contentType.includes("html") ||
      contentType.includes("text") ||
      contentType.includes("javascript"))
  ) {
    const html = await response.text();

    const allEmailMatches = [
      ...html.matchAll(
        new RegExp("data-cfemail=\"([a-z0-9]+)\"", "g"),
        new RegExp("email-protection#([a-z0-9]+)\"", "g")
      ),
    ];

    const replaceAdd = {};
    for (const [_, orgCfEmail] of allEmailMatches) {
      let orgCfEmailDecode = cfDecodeEmail(orgCfEmail);
      for (const [rs, rd] of Object.entries(target.replace)) {
        orgCfEmailDecode = orgCfEmailDecode.replaceAll(rs, rd);
      }
      orgCfEmailDecode = orgCfEmailDecode.replaceAll(target.host, target.f_host);
      replaceAdd[orgCfEmail] = cfEncodeEmail(orgCfEmailDecode);
    }

    target.replace = {
      ...target.replace,
      ...replaceAdd,
    };

    let modifiedHtml = html;
    for (const [rs, rd] of Object.entries(target.replace)) {
      modifiedHtml = modifiedHtml.replaceAll(rs, rd);
    }
    modifiedHtml = modifiedHtml.replaceAll(target.host, target.f_host);

    return new Response(modifiedHtml, {
      headers: response.headers,
    });
