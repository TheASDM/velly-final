"""What an uploaded file actually is, rather than what it claims to be.

The client's declared MIME type is a claim. Magic bytes are a better claim.
Neither proves a file is an image — a .png that starts with the PNG magic
and then contains garbage is still a file we would hand to every browser at
the table. So images are decoded here, in full, and measured: a file that
will not decode is not an image, and one that decodes to a hundred million
pixels is a decompression bomb rather than a handout.

Shared by the chat attachment pipeline and the DM's handout uploads, which
until now accepted any RIFF container as a WebP — a .wav renamed .webp went
straight through.
"""
from ..imports import *

IMAGE_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
PDF_MIME = "application/pdf"

# A WebP is a RIFF container whose form type is "WEBP" at offset 8. Checking
# only for "RIFF" accepts WAV and AVI as well.
IMAGE_MAGIC = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".gif": (b"GIF87a", b"GIF89a"),
}

# 40 megapixels: comfortably past any phone camera, nowhere near the size
# where decoding costs real memory.
MAX_IMAGE_PIXELS = 40_000_000
# Pillow's own bomb guard, set below ours so it trips first on the absurd.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class UploadRejected(Exception):
    """Carries the message and status the route should answer with."""

    def __init__(self, message, status=415):
        super().__init__(message)
        self.message = message
        self.status = status


def _looks_like_webp(data):
    return data[:4] == b"RIFF" and data[8:12] == b"WEBP"


def check_magic(data, ext):
    if ext == ".webp":
        return _looks_like_webp(data)
    return any(data.startswith(magic) for magic in IMAGE_MAGIC.get(ext, ()))


def looks_like_pdf(data):
    # %PDF- may sit behind a short run of junk in the wild, but nothing we
    # accept needs that latitude.
    return data.startswith(b"%PDF-")


def decode_image(data, ext):
    """Decode the file for real and return (width, height).

    verify() checks structure but leaves the image unusable, so the file is
    opened twice: once to verify, once to actually pull the pixels through
    load(). A file that survives both is an image."""
    try:
        with Image.open(io.BytesIO(data)) as probe:
            probe.verify()
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
            if width * height > MAX_IMAGE_PIXELS:
                raise UploadRejected(
                    "That image is too many pixels to open safely.", 413
                )
            image.load()
    except UploadRejected:
        raise
    except Exception:
        raise UploadRejected(
            "That file does not decode as the image type it claims."
        ) from None
    if not width or not height:
        raise UploadRejected("That image has no dimensions.")
    return width, height


def validate_image(data, mimetype):
    """Full check for one uploaded image. Returns (ext, width, height)."""
    ext = IMAGE_EXTENSIONS.get((mimetype or "").lower())
    if not ext:
        raise UploadRejected("PNG, JPEG, WebP or GIF only.")
    if not check_magic(data, ext):
        raise UploadRejected("That file does not look like the image type it claims.")
    width, height = decode_image(data, ext)
    return ext, width, height


def write_thumbnail(data, destination, box=512):
    """A small JPEG beside the original, for grids. Failure is not fatal —
    the grid falls back to the full image."""
    try:
        with Image.open(io.BytesIO(data)) as image:
            image = image.convert("RGB")
            image.thumbnail((box, box))
            image.save(destination, format="JPEG", quality=82, optimize=True)
        return True
    except Exception:
        logging.warning("Thumbnail failed for %s", destination, exc_info=True)
        return False


__all__ = ['IMAGE_EXTENSIONS', 'PDF_MIME', 'IMAGE_MAGIC', 'MAX_IMAGE_PIXELS',
           'UploadRejected', 'check_magic', 'looks_like_pdf', 'decode_image',
           'validate_image', 'write_thumbnail']
