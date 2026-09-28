# Country photo catalog

`countryPhotos.json` maps ISO country codes to panoramic Wikimedia Commons images.
The catalog was retrieved on 2026-09-28 using Wikidata country code (P297) and
Wikivoyage page banner (P948) statements (capital city banners for Germany, Iran,
and Tanzania), followed by the Commons imageinfo API
(`url|extmetadata`, thumbnail width 1920) for each file's attribution and license.

Sources:
- https://www.wikidata.org/wiki/Property:P948
- https://www.mediawiki.org/wiki/API:Imageinfo

Only supported country codes with Creative Commons or public-domain images are
included. Each entry retains its source file page, photographer, and license.
The trip header exposes these credits and notes that the image is cropped to fit.
68 verified photos, including Great Britain, are bundled under
`public/images/countries` and served by the website. Their original image URLs
are retained in `remoteUrl`. Remaining entries use Wikimedia-hosted images;
bulk retrieval encountered HTTP 429 responses, so those may still be unavailable
when the provider rate-limits requests. Image requests send no referrer. No image
search, API key, or remote metadata request is needed at runtime. Country names,
aliases (including the legacy spelling "Great Britian"), and Hebrew names use
`resolveCountry`.

Unknown countries, missing catalog entries, and image load failures use the
header's green gradient. Trip content remains available independently of images.
When replacing an image, verify its country, image URL, author, and license against
the source file page and update all attribution fields together.
