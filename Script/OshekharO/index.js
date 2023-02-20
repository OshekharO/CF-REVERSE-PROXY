addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Define the replacement files
  const fileReplacements = [    {      searchFile: 'adsense.js',      replaceFile: 'adlock.js'    }  ]

  // Prompt the user to enter a website URL
  let websiteUrl = null
  if (request.method === 'POST') {
    const body = await request.text()
    const params = new URLSearchParams(body)
    websiteUrl = params.get('url')
  }

  // If the website URL is not provided, prompt the user to enter it
  if (!websiteUrl) {
    const form = `
      <form id="url-form" method="POST">
        <label for="url">Enter the website URL:</label>
        <input type="url" name="url" required>
        <button type="submit">Submit</button>
      </form>
      <style>
        #url-form {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 20px;
        }

        label {
          font-size: 1.2em;
          margin-bottom: 10px;
        }

        input[type="text"] {
          padding: 10px;
          border: none;
          border-radius: 5px;
          box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
          width: 300px;
          font-size: 1.2em;
        }

        button[type="submit"] {
          padding: 10px 20px;
          background-color: #007bff;
          color: #fff;
          border: none;
          border-radius: 5px;
          font-size: 1.2em;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        button[type="submit"]:hover {
          background-color: #0056b3;
        }

        button[type="submit"]:focus {
          outline: none;
          box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
        }
      </style>
    `
    return new Response(form, { headers: { 'Content-Type': 'text/html' } })
  }

  // Fetch the requested URL
  const response = await fetch(websiteUrl)

  // If the response status is not 200, return the original response
  if (response.status !== 200) {
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
  const url = new URL(websiteUrl)
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
  const adServiceRegex = /((doubleclick|adservice\.google|googletagservices|googlesyndication|google-analytics|infolinks|taboola|trafficjunky|bidvertiser|fastclick)\.com|ads\.facebook\.com|advertising\.twitter\.com|ads\.linkedin\.com|adsafeprotected\.com)/;

  // Check if the URL matches the ad service regular expression
  return adServiceRegex.test(url.hostname);
}
