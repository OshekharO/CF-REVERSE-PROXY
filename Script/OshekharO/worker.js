addEventListener("fetch", (event) => {
 event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
 const url = new URL(request.url);

 // Check if the request is for a specific website
 if (url.hostname === "saksham.thedev.id") {
  // Fetch the original response
  const response = await fetch(request);

  // Check if the response is an HTML document
  if (response.headers.get("content-type").includes("text/html")) {
   // Modify the response body
   const body = await response.text();
   const modifiedBody = replaceTextAndAttributes(body);

   // Create a new response with the modified body
   return new Response(modifiedBody, response);
  }
 }

 // Pass through the request and response
 return fetch(request);
}

function replaceTextAndAttributes(body) {
 // Define the replacements
 const replacements = [
  {
   searchValue: "computer",
   replaceValue: "comp",
  },
  {
   searchValue: "mouse",
   replaceValue: "mouz",
  },
  {
   searchValue: "div",
   replaceValue: "span",
  },
 ];

 let modifiedBody = body;

 // Replace the text values
 replacements.forEach((replacement) => {
  modifiedBody = modifiedBody.replace(new RegExp(replacement.searchValue, "g"), replacement.replaceValue);
 });

 // Replace the attribute values
 const attributeReplacements = [
  {
   tag: "a",
   attribute: "href",
   searchValue: "/about",
   replaceValue: "/contact",
  },
  {
   tag: "img",
   attribute: "alt",
   searchValue: "computer",
   replaceValue: "comp",
  },
 ];

 attributeReplacements.forEach((attributeReplacement) => {
  const tagRegex = new RegExp(`<${attributeReplacement.tag} [^>]*>`, "g");
  const attributeRegex = new RegExp(`${attributeReplacement.attribute}="([^"]*)"`, "g");

  modifiedBody = modifiedBody.replace(tagRegex, (match) => {
   return match.replace(attributeRegex, (match, group1) => {
    if (group1.includes(attributeReplacement.searchValue)) {
     const modifiedValue = group1.replace(attributeReplacement.searchValue, attributeReplacement.replaceValue);
     return `${attributeReplacement.attribute}="${modifiedValue}"`;
    }
    return match;
   });
  });
 });

 // Replace the HTML tags
 const tagReplacements = [
  {
   searchTag: "ul",
   replaceTag: "ol",
  },
  {
   searchTag: "h1",
   replaceTag: "h2",
  },
 ];

 tagReplacements.forEach((tagReplacement) => {
  const searchRegex = new RegExp(`<${tagReplacement.searchTag}([^>]*)>`, "g");
  const replaceValue = `<${tagReplacement.replaceTag}$1>`;

  modifiedBody = modifiedBody.replace(searchRegex, replaceValue);
 });

 // Replace the file
 const fileReplacements = [
  {
   searchFile: "adsense.js",
   replaceFile: "adlock.js",
  },
 ];

 fileReplacements.forEach((fileReplacement) => {
  const fileRegex = new RegExp(fileReplacement.searchFile, "g");
  const replaceValue = fileReplacement.replaceFile;

  modifiedBody = modifiedBody.replace(fileRegex, replaceValue);
 });

 return modifiedBody;
}

function isAdResource(url) {
 const adResourceUrls = ["googleadservices.com", "doubleclick.net", "googlesyndication.com", "adservice.google.com", "adservice.google.co.uk", "adservice.google.de", "adservice.google.fr", "adservice.google.it", "adservice.google.es"];

 // Check if the URL matches any of the known ad resource URLs
 return adResourceUrls.some((adResourceUrl) => url.hostname.endsWith(adResourceUrl));
}
