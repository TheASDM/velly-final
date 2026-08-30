from ..imports import *
from ..symbols import *
from ..config import *

def _yaml_quote(value):
    return json.dumps(str(value or ""), ensure_ascii=False)


def _chown_like_site(path):
    try:
        site_stat = SITE_SOURCE_DIR.stat()
        os.chown(path, site_stat.st_uid, site_stat.st_gid)
    except Exception:
        pass


IMAGE_PLACEHOLDER_RE = re.compile(r"\{\{?\s*IMAGE\s*\}?\}", re.IGNORECASE)
MARKDOWN_IMAGE_RE = re.compile(r"^\s*!\[[^\]]*\]\([^)]+\)\s*$", re.MULTILINE)
_WIKI_GALLERY_HEADING_RE = re.compile(r"(?m)^##\s+Gallery\s*$")
_WIKI_NEXT_H2_RE = re.compile(r"(?m)^##\s+")

# The wiki content lives under these top-level directories. Any repo-root
# markdown file is reachable as /en/<rel>/, so writes must be confined here —
# otherwise README.md, CLAUDE.md, or node_modules docs are writable via the API.
WIKI_CONTENT_ROOTS = (
    "Articles",
    "Class-Changes",
    "House-Rules",
    "Session-Chronicles",
    "Updates",
    "Venturia",
)


def _wiki_source_in_content_roots(source_path):
    try:
        rel = source_path.resolve().relative_to(SITE_SOURCE_DIR.resolve())
    except (ValueError, OSError):
        return False
    return bool(rel.parts) and rel.parts[0] in WIKI_CONTENT_ROOTS

def _strip_markdown_title(markdown):
    body = (markdown or "").strip()
    return re.sub(r"^#\s+.*(?:\n+|$)", "", body, count=1).strip()


def _strip_generated_images(markdown):
    body = IMAGE_PLACEHOLDER_RE.sub("", markdown or "")
    body = MARKDOWN_IMAGE_RE.sub("", body)
    return re.sub(r"\n{3,}", "\n\n", body).strip()


def _markdown_with_image(markdown, title, image_url):
    body = (markdown or "").strip()
    if not re.match(r"^#\s+", body):
        body = f"# {title}\n\n{body}" if body else f"# {title}"
    if not image_url:
        return IMAGE_PLACEHOLDER_RE.sub("", body).strip() + "\n"

    image_markdown = f"![{title}]({image_url})"
    if IMAGE_PLACEHOLDER_RE.search(body):
        body = IMAGE_PLACEHOLDER_RE.sub(image_markdown, body, count=1)
        return body.strip() + "\n"

    lines = body.splitlines()
    if lines and lines[0].startswith("# "):
        return "\n".join([lines[0], "", image_markdown, "", *lines[1:]]).strip() + "\n"
    return f"{image_markdown}\n\n{body}".strip() + "\n"


def _page_frontmatter(title, summary, tags):
    # Date-stamp in the table's timezone so a late-evening publish doesn't
    # land on tomorrow's date.
    now = datetime.now(CAMPAIGN_TZ).strftime("%Y-%m-%dT00:00:00.000Z")
    return (
        "---\n"
        f"title: {_yaml_quote(title)}\n"
        f"description: {_yaml_quote(summary)}\n"
        "published: true\n"
        f"date: {now}\n"
        f"tags: {tags}\n"
        "editor: markdown\n"
        f"dateCreated: {now}\n"
        "---\n\n"
    )


def _source_file_url(source_file):
    source_file = str(source_file or "").strip()
    if not source_file or source_file.startswith("5e-filtered/") or not source_file.endswith(".md"):
        return None
    path = source_file[:-3]
    if path.endswith("/index"):
        path = path[:-6]
    return f"/en/{path}/" if path else None


def _source_path_to_wiki_url(source_path):
    try:
        rel = source_path.resolve().relative_to(SITE_SOURCE_DIR.resolve()).as_posix()
    except (ValueError, OSError):
        return None
    return _source_file_url(rel)


def _wiki_url_to_source_path(wiki_url):
    """Inverse of _source_file_url: '/en/Venturia/Items/foo/' -> the on-
    disk SITE_SOURCE_DIR/Venturia/Items/foo.md (or .../index.md for
    section roots). Returns None when the URL isn't a wiki page or the
    target source file doesn't exist."""
    if not wiki_url or not isinstance(wiki_url, str):
        return None
    if not wiki_url.startswith("/en/"):
        return None
    # Normalise: strip /en/ prefix and trailing slash
    rel = wiki_url[4:].rstrip("/")
    if not rel:
        return None
    # Reject path traversal — `..` and absolute paths can never refer to
    # a wiki source file under SITE_SOURCE_DIR.
    if ".." in rel.split("/") or rel.startswith("/"):
        return None
    candidates = [
        SITE_SOURCE_DIR / f"{rel}.md",
        SITE_SOURCE_DIR / rel / "index.md",
    ]
    for path in candidates:
        try:
            path.resolve().relative_to(SITE_SOURCE_DIR.resolve())
        except (ValueError, OSError):
            continue
        if path.exists() and path.is_file():
            return path
    return None


_FRONTMATTER_RE = re.compile(r"\A\ufeff?---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.DOTALL)


def _validate_wiki_frontmatter(content):
    """Validate a wiki page's frontmatter before it is written. Broken YAML
    used to save fine and then fail the async build silently. Returns an
    error message, or None when the content is publishable."""
    match = _FRONTMATTER_RE.match(content or "")
    if not match:
        return "The page must start with a '---' YAML frontmatter block"
    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError as exc:
        return f"Frontmatter is not valid YAML: {exc}"
    if not isinstance(data, dict):
        return "Frontmatter must be a YAML mapping (title: ..., description: ...)"
    title = data.get("title")
    if title is None or not str(title).strip():
        return "Frontmatter must include a non-empty title"
    return None


def _wiki_source_hash(text):
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _wiki_source_title(text):
    title_match = re.search(r"(?m)^title:\s*(.+?)\s*$", text or "")
    if not title_match:
        return ""
    raw = title_match.group(1).strip()
    try:
        return str(json.loads(raw))
    except Exception:
        return raw.strip("'\"")


def _read_wiki_source_payload(source_path):
    text = source_path.read_text(encoding="utf-8")
    rel = source_path.resolve().relative_to(SITE_SOURCE_DIR.resolve()).as_posix()
    stat = source_path.stat()
    title = _wiki_source_title(text)
    return {
        "url": _source_path_to_wiki_url(source_path),
        "source_file": rel,
        "title": title,
        "content": text,
        "hash": _wiki_source_hash(text),
        "updated_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
    }


def _append_image_to_wiki_gallery(source_path, image_abs_url, alt_text,
                                  gallery_id, pinned_by):
    """Append an image to the wiki page's ## Gallery section, creating
    that section if it doesn't exist. Idempotent on image_abs_url.
    Returns True if the file was modified, False if the image was
    already present."""
    text = source_path.read_text(encoding="utf-8")

    # Idempotency: any existing reference to this image URL counts as
    # already-pinned. Avoids accidental duplicates from double-clicks.
    if image_abs_url in text:
        return False

    safe_alt = re.sub(r"[\[\]\n]", " ", str(alt_text or "Pinned art")).strip() or "Pinned art"
    comment = (
        f"<!-- pinned by {pinned_by or 'unknown'}, "
        f"gallery_id {gallery_id}, {_utc_now_iso()} -->"
    )
    image_line = f"![{safe_alt}]({image_abs_url})"
    block = f"{comment}\n{image_line}\n"

    gallery_match = _WIKI_GALLERY_HEADING_RE.search(text)
    if gallery_match:
        # Insert at the end of the existing Gallery section (right before
        # the next H2, or at EOF if Gallery is the last section).
        start = gallery_match.end()
        next_h2 = _WIKI_NEXT_H2_RE.search(text, start)
        if next_h2:
            insert_pos = next_h2.start()
            head = text[:insert_pos].rstrip() + "\n\n"
            tail = text[insert_pos:]
            new_text = head + block + "\n" + tail
        else:
            new_text = text.rstrip() + "\n\n" + block
    else:
        new_text = text.rstrip() + "\n\n---\n\n## Gallery\n\n" + block

    source_path.write_text(new_text, encoding="utf-8")
    _chown_like_site(source_path)
    return True

__all__ = ['_yaml_quote', '_chown_like_site', 'IMAGE_PLACEHOLDER_RE', 'MARKDOWN_IMAGE_RE', '_WIKI_GALLERY_HEADING_RE', '_WIKI_NEXT_H2_RE', 'WIKI_CONTENT_ROOTS', '_wiki_source_in_content_roots', '_strip_markdown_title', '_strip_generated_images', '_markdown_with_image', '_page_frontmatter', '_source_file_url', '_source_path_to_wiki_url', '_wiki_url_to_source_path', '_validate_wiki_frontmatter', '_wiki_source_hash', '_wiki_source_title', '_read_wiki_source_payload', '_append_image_to_wiki_gallery']
