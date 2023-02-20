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

target = {} //Temporary variable, do not edit

addEventListener("fetch", event => {
    var request = event.request
    var url = new URL(event.request.url);
    for (const [s_domain, s_target] of Object.entries(reverse)) {
        // console.log(url.host)
        if (url.host.endsWith(s_domain)) {
            target = reverse[s_domain];
            target.f_host = s_domain;
            // console.log("Match: " + s_domain)
            break;
        } else {
            // console.log("Not Match: " + s_domain)
            continue;
        }
    }

    if (target.f_host == undefined) {
        return event.respondWith(new Response("Not found",{
            status: 404,
        }));
    }

    url.protocol = target.protocol;
    url.host = target.host;

    if (url.pathname in target.redirect) {
        //console.log(" 302 to " + target.redirect[url.pathname])
        return event.respondWith(new Response("",{
            status: 302,
            headers:{
                "Location": target.redirect[url.pathname],
            }
        }))
    }

    if (url.pathname in target.reverse) {
        reverse_target = target.reverse[url.pathname]
        if (reverse_target.startsWith("http") ) {
            url = new URL(reverse_target)
        } else{
            url.pathname = reverse_target
        }
        
    }

    if (target.path_prefix) {
        url.pathname = target.path_prefix +  url.pathname
    }

    const modifiedRequest = new Request(url, {
        body: request.body,
        headers: request.headers,
        method: request.method
    })
    event.passThroughOnException();
    return event.respondWith(handleRequest(modifiedRequest));
})

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
    out = key.toString(16).padStart(2, "0")
    for (const c of email) {
        out += (c.charCodeAt(0) ^ key).toString(16).padStart(2, "0")
    }
    return out;
}

async function handleRequest(req) {
    //console.log("fetching " + req.url)
    var response = await fetch(req);

    let contype = response.headers.get("Content-Type")
    // Author: Kusakabe Si
    if (contype != null && (contype.includes("json") || contype.includes("html") || contype.includes("text") || contype.includes("javascript"))) {
        var html = await response.text();
        // Remove ads using regex
        html = html.replace(/<\s*div\s+class\s*=\s*["']?\s*ads?\s*["']?\s*>.*?<\s*\/\s*div\s*>/ig, "");
        // console.log(html)
        allemail = [...html.matchAll(new RegExp("data-cfemail=\"([a-z0-9]+)\"", "g"))].concat([...html.matchAll(new RegExp("email-protection#([a-z0-9]+)\"", "g"))])
        // console.log(allemail)
        replace_add = {}
        for (const [_, org_cf_email] of allemail) {
            org_cf_email_decode = cfDecodeEmail(org_cf_email)
            for (const [rs, rd] of Object.entries(target.replace)) {
                org_cf_email_decode = org_cf_email_decode.replaceAll(rs, rd);
            }
            org_cf_email_decode = org_cf_email_decode.replaceAll(target.host, target.f_host);
            replace_add[org_cf_email] = cfEncodeEmail(org_cf_email_decode)
        }
        // console.log(replace_add)
        target.replace = {
            ...target.replace,
            ...replace_add
        }
        target.html = html;
        // Simple replacement regex
        for (const [rs, rd] of Object.entries(target.replace)) {
            //console.log("replace " + rs + " to " + rd)
            html = html.replaceAll(rs, rd);
        }
        // console.log("replace " + target.host + " to " + target.f_host)
        html = html.replaceAll(target.host, target.f_host);
        // console.log(html)
        // return modified response
        return new Response(html, {
            headers: response.headers
        })
    } else {
        return response;
    }
}
