# Data-source compliance policy

Only official APIs, documented open downloads, or explicitly licensed services may be connected to the public WebGIS. Scraping a provider's human-facing interface is not permitted.

Before a source is enabled, `data/source-registry.json` must record its official terms URL, access method, attribution, commercial-use position, redistribution terms, and review status. A source marked `blocked` or `review-required` cannot have `used: true`; CI enforces this rule.

`conditional` means the source is currently suitable only while the stated conditions remain true, such as non-commercial use, low traffic, visible attribution, and published rate limits. A move to commercial or high-volume operation requires a new review and, where applicable, a paid plan or written permission.

BMKG PM2.5 must not be scraped or integrated automatically until the project has an official API path or written permission. OpenAQ records must be reviewed at original-provider level; an OpenAQ API response does not override a provider's terms.

Model outputs must be labelled as model outputs. Satellite detections must not be labelled as confirmed continuing fires. Provider names and logos must never imply endorsement of this project.
