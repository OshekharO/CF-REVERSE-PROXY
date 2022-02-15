reverse = {
    "uwiki.kskb.eu.org": {           // Domain of the cf worker
        "protocol": "https",         // HTTP or HTTPS, protocol of the original site
        "host": "en.wikipedia.org",  // Target domain
        "replace": {                //Replace string for all json/html/text/javascript through this proxy
            "Wiki": "Uncyclo",
        },
        "reverse": {                 // Additional reverse proxy for for custom resource, such as picture
            "/static/images/project-logos/enwiki.png": "https://images.uncyclomedia.co/uncyclopedia/en/b/bc/Wiki.png"
        },
        "redirect": {}               // 302 resirection
    },
    "revdemo.kskb.eu.org": {
        "protocol": "https",
        "host": "www.example.com",
        "replace": {
            "Example": "Demo",
            "Domain": "Site",
            "domain": "site",
            "More": "Less",
            "https://www.iana.org/sites/example": "https://github.com/KusakabeSi/cf-revpxy"
        },
        "reverse": {},
        "redirect": {}
    },
    "blog.kskb.eu.org": {
        "protocol": "https",
        "host": "www.kskb.eu.org",
        "replace": {},
        "reverse": {},
        "redirect": {}
    },
    "blog.wget.date": {
        "protocol": "https",
        "host": "www.kskb.eu.org",
        "replace": {},
        "reverse": {},
        "redirect": {}
    },
    "42status.kskb.eu.org": {
        "protocol": "https",
        "host": "stats.uptimerobot.com",
        "replace": {
            'pageUrl=': 'pageUrl="https://42status.kskb.eu.org/jB082hYYXv";',
        },
        "reverse": {
            "/": "/jB082hYYXv",
        },
        "redirect": {
            "/assets/sounds/notification.mp3": "https://stats.uptimerobot.com/assets/sounds/notification.mp3",
            "/jB082hYYXv": "/"
        }
    },
    "wix.kskb.eu.org": {
        "protocol": "https",
        "host": "kskbsi.wixsite.com",
        "replace": {
            'id="WIX_ADS"': 'id="WIX_ADS" style="display:none"',
        },
        "reverse": {
            "/": "/blog"
        },
        "redirect": {
           
        }
    }
}
