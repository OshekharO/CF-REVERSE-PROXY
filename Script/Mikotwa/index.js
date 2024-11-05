/* A CF-REVERSE-PROXY Script For Cloudflare Workers at https://github.com/OshekharO/CF-REVERSE-PROXY */

const WORKER_HOSTNAME = "proxy.oshekher.workers.dev";

let real_hostname = null;
let real_path = null;

async function handleRequest(req) {
    let parsedUrl = new URL(req.url);
    let referer = req.headers.get("Referer");

    // If there is a Referer from the node, modify to forward
    if (referer) {
        parsedUrl = new URL(referer);
    }

    // Intercept the real domain name and path
    let first_char_index = parsedUrl.href.indexOf(WORKER_HOSTNAME) + WORKER_HOSTNAME.length + 1;
    let second_char_index = parsedUrl.href.indexOf('/', first_char_index + 1);

    if (second_char_index === -1) {
        let attribute_index = parsedUrl.href.indexOf('?', first_char_index);
        if (attribute_index === -1) { // URL does not end with /, and no query string starting with ?
            real_hostname = parsedUrl.href.substring(first_char_index);
            real_path = '';
        } else {  // Contains ? query string
            real_hostname = parsedUrl.href.substring(first_char_index, attribute_index);
            real_path = parsedUrl.href.substring(attribute_index);
        }
    } else {  // URL ends with ? /
        real_hostname = parsedUrl.href.substring(first_char_index, second_char_index);
        real_path = parsedUrl.href.substring(second_char_index);
    }

    console.log(real_hostname);
    console.log(real_path);

    const res = await fetch('https://' + real_hostname + real_path, {
        headers: {
            'Referer': parsedUrl.origin + parsedUrl.pathname
        }
    });

    // remove nosniff
    let clean_res = new Response(res.body, res);
    clean_res.headers.delete("x-content-type-options");

    const Accept = req.headers.get("Accept") || "";

    // If request header Accept contains text/css, do not pass to HTMLRewriter
    if (Accept.includes("text/css")) {
        const contentType = clean_res.headers.get("content-type") || "";
        if (contentType.includes("text/javascript")) {
            let css_res = new Response(clean_res.body, clean_res);
            css_res.headers.set("content-type", contentType.replace("text/javascript", "text/css"));
            return css_res;
        }

        clean_res.headers.set("content-type", "text/css; charset=utf-8");
        return clean_res;
    }

    return rewriter.transform(clean_res);
}

class AttributeRewriter {
    constructor(attributeName) {
        this.attributeName = attributeName;
    }

    element(element) {
        const attribute = element.getAttribute(this.attributeName);
        if (attribute) {
            console.log(`Rewriting ${this.attributeName} from ${attribute}`);
            if (attribute.startsWith('https://')) {
                element.setAttribute(this.attributeName, 'https://' + WORKER_HOSTNAME + '/' + real_hostname + attribute.substring(8));
            } else if (attribute.startsWith('//')) {
                element.setAttribute(this.attributeName, '//' + WORKER_HOSTNAME + '/' + real_hostname + attribute.substring(2));
            } else if (attribute.startsWith('/')) {
                element.setAttribute(this.attributeName, 'https://' + WORKER_HOSTNAME + '/' + real_hostname + attribute);
            } else if (!attribute.startsWith('http')) {
                element.setAttribute(this.attributeName, 'https://' + WORKER_HOSTNAME + '/' + real_hostname + '/' + attribute);
            }
            console.log(`Rewritten ${this.attributeName} to ${element.getAttribute(this.attributeName)}`);
        }
    }
}

const rewriter = new HTMLRewriter()
    .on("a", new AttributeRewriter("href"))
    .on("img", new AttributeRewriter("src"))
    .on("img", new AttributeRewriter("data-src"))
    .on("iframe", new AttributeRewriter("src"))
    .on("link", new AttributeRewriter("href"))
    .on("script", new AttributeRewriter("src"));

addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});
