/*
      _______  _______    _______  _______           _______  _______  _______  _______    _______  _______  _______                   
     (  ____ \(  ____ \  (  ____ )(  ____ \|\     /|(  ____ \(  ____ )(  ____ \(  ____ \  (  ____ )(  ____ )(  ___  )|\     /||\     /|
     | (    \/| (    \/  | (    )|| (    \/| )   ( || (    \/| (    )|| (    \/| (    \/  | (    )|| (    )|| (   ) |( \   / )( \   / )
     | |      | (__      | (____)|| (__    | |   | || (__    | (____)|| (_____ | (__      | (____)|| (____)|| |   | | \ (_) /  \ (_) / 
     | |      |  __)     |     __)|  __)   ( (   ) )|  __)   |     __)(_____  )|  __)     |  _____)|     __)| |   | |  ) _ (    \   /  
     | |      | (        | (\ (   | (       \ \_/ / | (      | (\ (         ) || (        | (      | (\ (   | |   | | / ( ) \    ) (   
     | (____/\| )        | ) \ \__| (____/\  \   /  | (____/\| ) \ \__/\____) || (____/\  | )      | ) \ \__| (___) |( /   \ )   | |   
     (_______/|/         |/   \__/(_______/   \_/   (_______/|/   \__/\_______)(_______/  |/       |/   \__/(_______)|/     \|   \_/   
                                                                                                                                  
A CF-REVERSE-PROXY Script For Cloudflare Workers at https://github.com/discordiy/CF-REVERSE-PROXY */

// Change the worker name to the actual version
const WORKER_HOSTNAME = "XXX.YYY.workers.dev"

let real_hostname = null
let real_path = null

async function handleRequest(req) {
  let parsedUrl = req.url
  let referer = req.headers.get("Referer")

  // If there is a Referer from the node, modify to forward
  if (referer != null) {
      parsedUrl = referer.toString()
  }

  // Intercept the real domain name and path
  let first_char_index = parsedUrl.indexOf(WORKER_HOSTNAME) + WORKER_HOSTNAME.length + 1
  let second_char_index = parsedUrl.indexOf('/', first_char_index + 1)
  
  if (second_char_index === -1) {
    let attribute_index = parsedUrl.indexOf('?', first_char_index)
    if (attribute_index === -1) { // URL does not end with /，and no query string starting with ?
      real_hostname = parsedUrl.substring(first_char_index)
      real_path = ''
    } else {  // Contains ? query string
      real_hostname = parsedUrl.substring(first_char_index, attribute_index)
      real_path = parsedUrl.substring(attribute_index)
    }
  } else {  // URL ends with ? /
      real_hostname = parsedUrl.substring(first_char_index, second_char_index)
      real_path = parsedUrl.substring(second_char_index)
  }

  console.log(real_hostname)
  console.log(real_path)

  const res = await fetch('https://' + real_hostname + real_path)

  // remove nosniff
  let clean_res = new Response(res.body, res)
  clean_res.headers.delete("x-content-type-options")
  
  const Accept = req.headers.get("Accept") || ""

  // 如果请求头 Accept 包含 text/css，则不交给 HTMLRewriter
  if (Accept.toString().indexOf("text/css") != -1) {
      const contentType = clean_res.headers.get("content-type") || ""
      if (contentType.toString().includes("text/javascript")) {
          let css_res = new Response(clean_res.body, clean_res)
          css_res.headers.set("content-type", contentType.replace("text/javascript", "text/css"))
          return css_res
      }

      clean_res.headers.set("content-type", "text/css; charset=utf-8")
      return clean_res
  }

  return rewriter.transform(clean_res)
}

class AttributeRewriter {
  constructor(attributeName) {
    this.attributeName = attributeName
  }
  element(element) {
    const attribute = element.getAttribute(this.attributeName)
    if (attribute == null) {

    } else if (attribute.startsWith('https://')) {
        element.setAttribute(
            this.attributeName,
            attribute.replace(attribute, 'https://' + WORKER_HOSTNAME + '/' + attribute.substring(8))
        )
    } else if (attribute.startsWith('//')) {
        element.setAttribute(
            this.attributeName,
            attribute.replace(attribute, '//' + WORKER_HOSTNAME + '/' + attribute.substring(2))
        )
    } else if (attribute.startsWith('/')) {
      element.setAttribute(
        this.attributeName,
        attribute.replace(attribute, '/' + real_hostname + attribute)
      )
    } else if (!attribute.startsWith('/') && attribute.indexOf('/') != 0) {
      element.setAttribute(
        this.attributeName,
        attribute.replace(attribute, '/' + real_hostname + '/' + attribute)
      )
    }
  }
}

const rewriter = new HTMLRewriter()
  .on("a", new AttributeRewriter("href"))
  .on("img", new AttributeRewriter("src"))
  .on("link", new AttributeRewriter("href"))
  .on("script", new AttributeRewriter("src"))

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})
