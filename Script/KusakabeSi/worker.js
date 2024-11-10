/*
      _______  _______    _______  _______           _______  _______  _______  _______    _______  _______  _______                   
     (  ____ \(  ____ \  (  ____ )(  ____ \|\     /|(  ____ \(  ____ )(  ____ \(  ____ \  (  ____ )(  ____ )(  ___  )|\     /||\     /|
     | (    \/| (    \/  | (    )|| (    \/| )   ( || (    \/| (    )|| (    \/| (    \/  | (    )|| (    )|| (   ) |( \   / )( \   / )
     | |      | (__      | (____)|| (__    | |   | || (__    | (____)|| (_____ | (__      | (____)|| (____)|| |   | | \ (_) /  \ (_) / 
     | |      |  __)     |     __)|  __)   ( (   ) )|  __)   |     __)(_____  )|  __)     |  _____)|     __)| |   | |  ) _ (    \   /  
     | |      | (        | (\ (   | (       \ \_/ / | (      | (\ (         ) || (        | (      | (\ (   | |   | | / ( ) \    ) (   
     | (____/\| )        | ) \ \__| (____/\  \   /  | (____/\| ) \ \__/\____) || (____/\  | )      | ) \ \__| (___) |( /   \ )   | |   
     (_______/|/         |/   \__/(_______/   \_/   (_______/|/   \__/\_______)(_______/  |/       |/   \__/(_______)|/     \|   \_/   
                                                                                                                                  

A CF-REVERSE-PROXY Script For Cloudflare Workers at https://github.com/OshekharO/CF-REVERSE-PROXY */

reverse = {}

target = {} // Temporary variable, do not edit

addEventListener("fetch", event => {
    var request = event.request
    var url = new URL(event.request.url);
    for (const [s_domain, s_target] of Object.entries(reverse)) {
        if (url.host.endsWith(s_domain)) {
            target = reverse[s_domain];
            target.f_host = s_domain;
            break;
        }
    }

    if (target.f_host == undefined) {
        return event.respondWith(new Response("Not found", {
            status: 404,
        }));
    }

    url.protocol = target.protocol;
    url.host = target.host;

    if (url.pathname in target.redirect) {
        return event.respondWith(new Response("", {
            status: 302,
            headers: {
                "Location": target.redirect[url.pathname],
            }
        }));
    }

    if (url.pathname in target.reverse) {
        const reverse_target = target.reverse[url.pathname];
        if (reverse_target.startsWith("http")) {
            url = new URL(reverse_target);
        } else {
            url.pathname = reverse_target;
        }
    }

    if (target.path_prefix) {
        url.pathname = target.path_prefix + url.pathname;
    }

    const modifiedRequest = new Request(url, {
        body: request.body,
        headers: request.headers,
        method: request.method
    });
    event.passThroughOnException();
    return event.respondWith(handleRequest(modifiedRequest));
});

function cfDecodeEmail(encodedString) {
    var email = "",
        r = parseInt(encodedString.substr(0, 2), 16),
        n, i;
    for (n = 2; encodedString.length - n; n += 2) {
        i = parseInt(encodedString.substr(n, 2), 16) ^ r;
        email += String.fromCharCode(i);
    }
    return email;
}

function cfEncodeEmail(email, key = 0) {
    var randomnumber = Math.floor(Math.random() * (99 - 11 + 1)) + 11;
    if (key == 0) {
        key = randomnumber;
    }
    let out = key.toString(16).padStart(2, "0");
    for (const c of email) {
        out += (c.charCodeAt(0) ^ key).toString(16).padStart(2, "0");
    }
    return out;
}

async function handleRequest(req) {
    try {
        var response = await fetch(req);

        let contype = response.headers.get("Content-Type");
        if (contype != null && (contype.includes("json") || contype.includes("html") || contype.includes("text") || contype.includes("javascript"))) {
            var html = await response.text();
            html = html.replace(/<\s*div\s+class\s*=\s*["']?\s*ads?\s*["']?\s*>.*?<\s*\/\s*div\s*>/ig, "");
            let allemail = [...html.matchAll(new RegExp("data-cfemail=\"([a-z0-9]+)\"", "g"))].concat([...html.matchAll(new RegExp("email-protection#([a-z0-9]+)\"", "g"))]);
            let replace_add = {};
            for (const [_, org_cf_email] of allemail) {
                let org_cf_email_decode = cfDecodeEmail(org_cf_email);
                for (const [rs, rd] of Object.entries(target.replace)) {
                    org_cf_email_decode = org_cf_email_decode.replaceAll(rs, rd);
                }
                org_cf_email_decode = org_cf_email_decode.replaceAll(target.host, target.f_host);
                replace_add[org_cf_email] = cfEncodeEmail(org_cf_email_decode);
            }
            target.replace = {
                ...target.replace,
                ...replace_add
            };
            target.html = html;

            // Single pass replacement
            const replaceRegex = new RegExp(Object.keys(target.replace).join('|'), 'g');
            html = html.replace(replaceRegex, match => target.replace[match]);
            html = html.replaceAll(target.host, target.f_host);

            return new Response(html, {
                headers: new Headers(response.headers)
            });
        } else {
            return response;
        }
    } catch (error) {
        console.error("Error handling request:", error);
        return new Response("Internal Server Error", {
            status: 500
        });
    }
}
