from ..imports import *
from ..symbols import *
from ..config import *

def _wiki_link_for_name(name):
    label = str(name or "").strip()
    if not label:
        return ""
    lookup = None
    if engine and getattr(engine, "_name_index", None):
        lookup = engine._name_index.get(label.lower())
    if not lookup:
        escaped = html.escape(label)
        return escaped

    for entry in lookup:
        url = _source_file_url(entry.get("source_file"))
        if url:
            return f'<a href="{html.escape(url)}">{html.escape(label)}</a>'
    return html.escape(label)


def _connection_target_for(connections, *relation_words):
    words = tuple(word.lower() for word in relation_words)
    for item in connections or []:
        relation = str(item.get("relation") or "").lower()
        target = str(item.get("target") or "").strip()
        if target and any(word in relation for word in words):
            return target
    return ""


def _infer_item_type(title, summary, markdown, image_prompt):
    text = f"{title} {summary} {markdown} {image_prompt}".lower()
    checks = [
        ("scimitar", "Scimitar"),
        ("sword", "Sword"),
        ("blade", "Blade"),
        ("dagger", "Dagger"),
        ("knife", "Knife"),
        ("coin", "Coin"),
        ("key", "Key"),
        ("mask", "Mask"),
        ("book", "Book"),
        ("tome", "Tome"),
        ("ring", "Ring"),
        ("amulet", "Amulet"),
        ("cloak", "Cloak"),
        ("staff", "Staff"),
        ("wand", "Wand"),
        ("lantern", "Lantern"),
    ]
    for needle, label in checks:
        if needle in text:
            return label
    return "Item"


def _infer_item_category(title, summary, markdown, image_prompt):
    text = f"{title} {summary} {markdown} {image_prompt}".lower()
    if any(word in text for word in ("weapon", "scimitar", "sword", "blade", "dagger")):
        return "Magic weapon" if any(word in text for word in ("magic", "magical", "enchanted", "charge", "attunement")) else "Weapon"
    if any(word in text for word in ("magic", "magical", "enchanted", "charge", "spell", "attunement")):
        return "Magic item"
    return "Named item"


def _item_card_row(label, value):
    if not value:
        return ""
    return (
        '<div><span style="color: #8b7355; letter-spacing: 0.18em; '
        'text-transform: uppercase; font-size: 0.7rem; font-weight: 600;">'
        f'{html.escape(label)}</span> &nbsp;&middot;&nbsp; {value}</div>\n'
    )


def _card_html(title, image_url, rows, quote):
    """Shared stat-card HTML used by every published lore page. `rows` is
    a list of strings already rendered by _item_card_row()."""
    image_block = ""
    if image_url:
        image_block = (
            '\n<div style="flex-shrink: 0;">\n'
            f'<img src="{html.escape(image_url)}" alt="{html.escape(title)}" '
            'style="width: 280px; max-width: 100%; border-radius: 4px; '
            'box-shadow: 0 10px 36px rgba(0, 0, 0, 0.8); '
            'border: 1px solid rgba(139, 115, 85, 0.5);">\n'
            '</div>\n'
        )
    quote_block = ""
    quote_text = str(quote or "").strip()
    if quote_text:
        quote_block = (
            '<div style="margin-top: 1.25rem; padding-left: 1rem; '
            'border-left: 2px solid rgba(212, 165, 116, 0.4); font-style: '
            'italic; color: rgba(212, 165, 116, 0.9); font-family: '
            "'IM Fell English', Georgia, serif; font-size: 1rem;\">"
            f'"{html.escape(quote_text)}"</div>'
        )
    rows_html = ''.join(rows).rstrip()
    return f"""<div style="display: flex; gap: 2rem; align-items: flex-start; margin: 0 0 2.5rem; padding: 1.5rem 1.75rem; background: linear-gradient(135deg, rgba(20, 18, 24, 0.55) 0%, rgba(36, 28, 18, 0.4) 100%); border: 1px solid rgba(139, 115, 85, 0.35); border-radius: 6px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6); flex-wrap: wrap;">

<div style="flex: 1; min-width: 240px;">
<div style="font-family: 'Cinzel', Georgia, serif; font-size: 2rem; letter-spacing: 0.08em; color: #d4a574; line-height: 1.1; margin-bottom: 0.75rem; text-transform: uppercase;">{html.escape(title)}</div>
<div style="height: 1px; background: linear-gradient(90deg, rgba(212, 165, 116, 0.7), rgba(139, 115, 85, 0.2) 60%, transparent); margin-bottom: 1.25rem;"></div>

<div style="font-family: Georgia, serif; font-size: 0.95rem; color: #e8dcc8; line-height: 1.85;">
{rows_html}
</div>
{quote_block}
</div>
{image_block}
</div>"""


def _render_item_markdown(title, summary, markdown, image_url, connections, image_prompt):
    body = _strip_generated_images(_strip_markdown_title(markdown))
    item_type = _infer_item_type(title, summary, body, image_prompt)
    category = _infer_item_category(title, summary, body, image_prompt)
    owner = _connection_target_for(connections, "owner", "holder", "carried")
    prior_owner = _connection_target_for(connections, "prior", "previous", "former")

    rows = [
        _item_card_row("Category", html.escape(category)),
        _item_card_row("Type", html.escape(item_type)),
        _item_card_row("Owner", _wiki_link_for_name(owner)) if owner else "",
        _item_card_row("Prior Owner", _wiki_link_for_name(prior_owner)) if prior_owner else "",
    ]
    quote = (summary or "").strip() or "A named item in the Vallombrosa campaign."
    card = _card_html(title, image_url, rows, quote)
    if not body:
        body = f"{summary}\n\n## Connections\n\n" + _connections_markdown(connections)
    return f"# {title}\n\n{card}\n\n{body.strip()}\n"


def _render_card_markdown(title, summary, markdown, image_url, card_fields):
    """Render a non-item published page with the AI's card_fields. Each
    field value is run through _wiki_link_for_name so any value that
    matches a known wiki entity becomes a hyperlink."""
    body = _strip_generated_images(_strip_markdown_title(markdown))
    rows = []
    for field in card_fields or []:
        if not isinstance(field, dict):
            continue
        label = str(field.get("label") or "").strip()
        value = str(field.get("value") or "").strip()
        if not label or not value:
            continue
        rows.append(_item_card_row(label, _wiki_link_for_name(value)))
    if not rows:
        # No card_fields means no card — fall back to plain image substitution.
        return _markdown_with_image(markdown, title, image_url)
    card = _card_html(title, image_url, rows, (summary or "").strip())
    if not body:
        body = f"{summary}\n"
    return f"# {title}\n\n{card}\n\n{body.strip()}\n"


def _connections_markdown(connections):
    lines = []
    for item in connections or []:
        relation = str(item.get("relation") or "Connection").strip()
        target = str(item.get("target") or "").strip()
        note = str(item.get("note") or "").strip()
        if not target:
            continue
        line = f"- **{target}** — {relation}"
        if note:
            line += f"; {note}"
        lines.append(line)
    return "\n".join(lines) if lines else "- No connections were provided."


def _render_published_markdown(kind, title, summary, markdown, image_url, connections, image_prompt, card_fields=None):
    if kind == "item":
        return _render_item_markdown(title, summary, markdown, image_url, connections, image_prompt)
    if card_fields:
        return _render_card_markdown(title, summary, markdown, image_url, card_fields)
    return _markdown_with_image(markdown, title, image_url)


def _copy_draft_image(submission_id, kind, slug):
    draft_image = LORE_DRAFT_IMAGES_DIR / f"{submission_id}.png"
    if not draft_image.exists():
        return None
    config = LORE_SUBMISSION_KINDS[kind]
    image_rel = f"{config['image_dir']}/{slug}.png"
    image_target = SITE_SOURCE_DIR / image_rel
    image_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(draft_image, image_target)
    _chown_like_site(image_target)
    return f"/{image_rel}"


def _remove_index_link(text, page_url):
    escaped = re.escape(page_url.rstrip("/"))
    lines = [
        line for line in (text or "").splitlines()
        if not re.search(rf"\]\({escaped}/?\)", line)
    ]
    cleaned = "\n".join(lines).rstrip() + "\n"
    cleaned = re.sub(
        r"\n---\n\n## Player Additions\n\n(?:\s*)$",
        "\n",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned


def _append_to_markdown_list(text, bullet):
    lines = text.rstrip().splitlines()
    last_bullet = None
    for idx, line in enumerate(lines):
        if line.startswith("- "):
            last_bullet = idx
    if last_bullet is None:
        return text.rstrip() + "\n\n" + bullet + "\n"
    lines.insert(last_bullet + 1, bullet)
    return "\n".join(lines).rstrip() + "\n"


def _append_to_named_markdown_section(text, section_title, bullet):
    heading = f"## {section_title}"
    if heading not in text:
        return text.rstrip() + f"\n\n---\n\n{heading}\n\n{bullet}\n"
    pattern = re.compile(
        rf"({re.escape(heading)}\n\n)(.*?)(\n---\n|\n## |\Z)",
        re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        return text.rstrip() + "\n" + bullet + "\n"
    replacement = match.group(1) + match.group(2).rstrip() + "\n" + bullet + match.group(3)
    return text[:match.start()] + replacement + text[match.end():]


def _append_index_link(kind, title, slug, summary):
    config = LORE_SUBMISSION_KINDS[kind]
    index_path = SITE_SOURCE_DIR / config["index"]
    if not index_path.exists():
        return False

    page_url = f"{config['url_prefix']}/{slug}"
    try:
        text = index_path.read_text(encoding="utf-8")
    except Exception:
        logging.exception("Could not read index %s", index_path)
        return False
    if page_url in text and config["index_mode"] not in {"simple-markdown", "other-markdown"}:
        return True

    clean_summary = (summary or "").strip()[:220] or f"Player-submitted {config['label'].lower()}."
    if config["index_mode"] == "npc-html":
        chip = (
            f'    <a class="vos-row-chip" href="{html.escape(page_url)}/">'
            f'<span><span class="vos-row-chip-title">{html.escape(title)}</span>'
            f'<span class="vos-row-chip-meta">{html.escape(clean_summary)}</span></span>'
            f'<span class="vos-row-chip-arrow" aria-hidden="true">&rsaquo;</span></a>\n'
        )
        pattern = re.compile(
            r'(<section class="vos-compact-panel" aria-labelledby="npc-others">.*?'
            r'<div class="vos-row-chip-list">\n)(.*?)(  </div>\n</section>)',
            re.DOTALL,
        )
        if pattern.search(text):
            text = pattern.sub(lambda m: m.group(1) + m.group(2) + chip + m.group(3), text, count=1)
        else:
            text = text.rstrip() + f"\n\n- **[{title}]({page_url})** — {clean_summary}\n"
    else:
        bullet = f"- **[{title}]({page_url})** — {clean_summary}"
        text = _remove_index_link(text, page_url)
        if config["index_mode"] == "simple-markdown":
            text = _append_to_markdown_list(text, bullet)
        else:
            text = _append_to_named_markdown_section(text, "Other Locations", bullet)

    try:
        index_path.write_text(text, encoding="utf-8")
        _chown_like_site(index_path)
        return True
    except Exception:
        logging.exception("Could not update index %s", index_path)
        return False


def _update_descriptions_json(kind, title, slug, summary, image_prompt):
    section = {
        "item": "items",
        "person": "npcs",
        "place": "locations",
    }.get(kind)
    if not section:
        return False

    path = SITE_SOURCE_DIR / "chatbot" / "descriptions.json"
    if not path.exists():
        return False

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        data.setdefault(section, {})
        aliases = [title]
        slug_alias = slug.replace("-", " ")
        if slug_alias.lower() != title.lower():
            aliases.append(slug_alias)
        desc = (image_prompt or summary or title).strip()
        if section == "locations":
            data[section][title] = {"aliases": aliases, "desc": desc}
        else:
            data[section][title] = {"aliases": aliases, "desc": desc}
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        _chown_like_site(path)
        return True
    except Exception:
        logging.exception("Could not update descriptions.json")
        return False

__all__ = ['_wiki_link_for_name', '_connection_target_for', '_infer_item_type', '_infer_item_category', '_item_card_row', '_card_html', '_render_item_markdown', '_render_card_markdown', '_connections_markdown', '_render_published_markdown', '_copy_draft_image', '_remove_index_link', '_append_to_markdown_list', '_append_to_named_markdown_section', '_append_index_link', '_update_descriptions_json']
