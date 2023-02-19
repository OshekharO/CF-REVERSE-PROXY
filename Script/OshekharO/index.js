addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Define the website URL and the replacement files
  const websiteUrl = 'https://example.com'
  const fileReplacements = [
    {
      searchFile: 'adsense.js',
      replaceFile: 'adlock.js'
    }
  ]

  // Fetch the requested URL
  const response = await fetch(request)

  // If the response status is not 200, return the original response
  if (response.status !== 200) {
    return response
  }

  // If the requested URL is not the website URL, return the original response
  const url = new URL(request.url)
  if (url.hostname !== 'example.com') {
    return response
  }

  // Check the user's IP address to determine if they are in a restricted country
  const country = await getCountryFromIp(request.headers.get('CF-Connecting-IP'))
  if (country === 'CN' || country === 'RU') {
    return new Response('Access to this website is restricted in your country.', { status: 403 })
  }

  // Read the response body and modify it to block ads and replace specified files
  const body = await response.text()
  let modifiedBody = body

  // Block ads by blocking requests to known ad resource URLs
  if (isAdResource(url)) {
    return new Response('', { status: 403 })
  }

  // Replace specified files
  fileReplacements.forEach(fileReplacement => {
    const fileRegex = new RegExp(fileReplacement.searchFile, 'g')
    const replaceValue = fileReplacement.replaceFile

    modifiedBody = modifiedBody.replace(fileRegex, replaceValue)
  })

// Filter out ads by replacing script or iframe tags with an empty string
  modifiedBody = modifiedBody.replace(/<\s*(script|iframe)[^>]*>[^<]*<\/\s*(script|iframe)\s*>/gi, '')

  // Return the modified response
  return new Response(modifiedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
}

async function getCountryFromIp(ipAddress) {
  const url = `https://api.ipgeolocation.io/ipgeo?apiKey=2bd6c5d15f414907b4bcb71e12542694&ip=${ipAddress}`
  const response = await fetch(url)
  const data = await response.json()
  return data.country_code2
}

function isAdResource(url) {
  const adServiceRegex = /((doubleclick|adservice\.google|googletagservices|googlesyndication|google-analytics|infolinks|taboola|trafficjunky|bidvertiser|fastclick)\.com|ads\.facebook\.com|advertising\.twitter\.com|ads\.linkedin\.com|adsafeprotected\.com/g)/;

  // Check if the URL matches the ad service regular expression
  return adServiceRegex.test(url.hostname);
}
