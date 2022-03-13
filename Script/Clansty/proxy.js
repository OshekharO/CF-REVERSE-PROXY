// You need to reverse the username of the Channel
const USERNAME = 'thewantedcracker'
// The URL to access this worker, which can be the domain name of the original .workers.dev. Note not the address of the web page you want to embed
const BASE_URL = '//tg-channel.clansty.workers.dev'
// Here you can also inject some CSS and required header information
const ICON = '<link rel="icon" type="image/webp" href="https://cdn.lwqwq.com/pic/41329_SaVJ3LWa.webp"/>' +
             '<base target="_blank" />' + 
             `<style>
                div.tgme_header_search {
                  display: none;
                }
                div.tgme_header_info {
                  margin-right: 0 !important;
                }
                div.tgme_footer {
                  display: none;
                }
              </style>`

const CHANNEL_URL = `https://t.me/s/${USERNAME}`

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function replaceText(resp){
    let ct = resp.headers.get('content-type')
    console.log(ct)
    if(!ct)return resp
    ct=ct.toLowerCase()
    if(!(ct.includes('text/html')||ct.includes('application/json')))return resp
    let text = await resp.text()
    text=text.replace(/<a class="tgme_channel_join_telegram" href="\/\/telegram\.org\/dl[\?a-z0-9_=]*">/g, 
        `<a class="tgme_channel_join_telegram" href="https://t.me/${USERNAME}">`)
      .replace(/<a class="tgme_channel_download_telegram" href="\/\/telegram\.org\/dl[\?a-z0-9_=]*">/g, 
        `<a class="tgme_channel_download_telegram" href="https://t.me/${USERNAME}">`)
      .replace(/<link rel="shortcut icon" href="\/\/telegram\.org\/favicon\.ico\?\d+" type="image\/x-icon" \/>/g, ICON)
      .replace(/\\?\/\\?\/telegram.org\\?\//g, `${BASE_URL}/tgorg/`)
      .replace(/\\?\/\\?\/cdn(\d).telesco.pe\\?\//g, `${BASE_URL}/ts/$1/`)
      .replace(/t.me\/[A-z0-9\_]{5,}\//g, `${BASE_URL}/`)
      .replace(/<div class="tgme_channel_download_telegram_bottom">to view and join the conversation<\/div>/g, "")
      .replace(/Download Telegram/g, "Join Channel")
    return new Response(text, {
        headers: { "content-type": ct }
    })
}

async function replaceTextForTgOrg(resp){
    let ct = resp.headers.get('content-type')
    if(!ct)return resp
    ct=ct.toLowerCase()
    if(!(ct.includes('text/css')))return resp
    let text = await resp.text()
    text=text.replace(/url\(\//g, `url(${BASE_URL}/tgorg/`)
      .replace(/url\('\//g, `url('${BASE_URL}/tgorg/`)
    return new Response(text, {
        headers: { "content-type": ct }
    })
}

async function handleRequest(request) {
    var u = new URL(request.url);
    var reg = /\/[0-9]*$/
    // Statistics node
    if(u.pathname==='/v/'){
      return new Response('true',{
        headers: { "content-type": "application/json" }
      })
    }
    // Home
    if(u.pathname==='/'){
      const req = new Request(CHANNEL_URL, {
        method: 'GET',
      })
      const result = await fetch(req)
      return replaceText(result)
    }
    // message location
    if(reg.test(u.pathname)){
      const req = new Request(CHANNEL_URL+u.pathname, {
        method: 'GET',
      })
      const result = await fetch(req)
      return replaceText(result)
    }
    

    const pathParts = u.pathname.split('/')
    pathParts.shift()
    const host = pathParts.length>0 ? pathParts[0] : ''
    const hostParam = pathParts.length>1 ? pathParts[1] : ''
    // Node of telegram.org
    if(host==='tgorg'){
      const req = new Request(`https://telegram.org/${pathParts.slice(1).join('/')}`, {
        method: 'GET',
      })
      const result = await fetch(req)
      return replaceTextForTgOrg(result)
    }
    // telescope node
    if(host==='ts'){
      const req = new Request(`https://cdn${hostParam}.telesco.pe/${pathParts.slice(2).join('/')}`, {
        method: 'GET',
      })
      const result = await fetch(req)
      return result
    }
    // load more
    if(host==='s'&&hostParam===USERNAME){
        u.host = 't.me'
        const req = new Request(u, {
            method: 'POST',
            headers: {'X-Requested-With': 'XMLHttpRequest'}
        });
        const result = await fetch(req);
        return replaceText(result)
    }

    return await fetch(new Request('https://qwq.clansty.workers.dev',{
        method: request.method,
        headers: request.headers,
        body: request.body
    }))
}
