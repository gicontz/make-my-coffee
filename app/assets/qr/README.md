# QR source images

Unedited share-QR screenshots exported from GCash, Maya and GoTyme.

**Nothing imports these.** They are the source; the files the site actually
serves are `public/qr/*.jpg`, derived from these by cropping to the card and
resizing to 800px wide. `public/` rather than a static import because the
confirmation email needs a URL that survives a redeploy — `/_next/static/media`
paths are content-hashed and 404 once a new deployment takes over the domain,
which would break the QR in every email already sent.

`bank.JPG` is the GoTyme one; it becomes `public/qr/gotyme.jpg`, matching the
`gotyme` payment-method value.

## Rotating a QR

Replace the source here, then regenerate:

```python
from PIL import Image
# GCash's is a full phone screenshot — crop to the white card first.
im = Image.open('app/assets/qr/gcash.JPG').convert('RGB').crop((154, 342, 1016, 1450))
im.thumbnail((800, 4000), Image.LANCZOS)
im.save('public/qr/gcash.jpg', quality=88, optimize=True, progressive=True)
```

Maya and GoTyme need no crop — resize only.

Then update the matching entry in `lib/paymentMethods.ts`: `width`/`height`
must match the new file (Next's `<Image>` uses them for layout), and
`accountName`/`accountRef` must match what the new QR prints.

## Verifying a QR

These are EMVCo payloads — decode one and the account details are plain text:

```python
import cv2
data, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread('public/qr/maya.jpg'))
print(data)  # ...5922ROMEL ENTIENZA MACINAS... with the full account number
```

Maya and GoTyme decode cleanly this way, which is how their `accountName` and
`accountRef` in `lib/paymentMethods.ts` were confirmed. **The GCash one does
not decode with OpenCV** — dense payload plus the InstaPay logo overlay — so it
has never been verified by machine, only by eye.

That decoded payload also contains the *unmasked* account number. We display
the wallet's masked form on purpose (a named person's mobile number on a public
page is the account holder's decision), but the full value is one decode away if
we ever want to offer a typable fallback.

**Scan every regenerated QR with a real phone before shipping it** — especially
GCash, where nothing else can check it. A wrong or corrupted QR sends customers'
money somewhere else, silently.
