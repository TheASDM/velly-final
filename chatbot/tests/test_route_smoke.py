"""Route-map smoke test: every registered route must answer an
unauthenticated (and a plain-player) request without crashing.

Unlike the pinned contract in test_routes.py, this iterates the live url_map,
so a brand-new route is covered the moment it registers. It exists to catch
the NameError-at-request-time class of bug that the star-import architecture
hides from linters: a handler that 500s the first time someone actually
calls it. 503 is allowed — several routes deliberately answer 'not
configured' — anything else in the 5xx range is a crash."""

from werkzeug.routing import IntegerConverter, PathConverter

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _placeholder_values(rule):
    values = {}
    for argument in rule.arguments:
        converter = rule._converters[argument]
        if isinstance(converter, IntegerConverter):
            values[argument] = 1
        elif isinstance(converter, PathConverter):
            values[argument] = "missing.txt"
        else:
            values[argument] = "missing"
    return values


def test_every_route_survives_without_credentials(app, auth_headers, server_module):
    try:
        failures = []
        for rule in app.url_map.iter_rules():
            built = rule.build(_placeholder_values(rule), append_unknown=False)
            if not built:
                continue
            _domain, path = built
            for method in sorted(rule.methods - {"HEAD", "OPTIONS"}):
                for role in ("anonymous", "player"):
                    with app.test_client() as client:
                        response = client.open(
                            path,
                            method=method,
                            json={} if method in WRITE_METHODS else None,
                            headers=auth_headers[role],
                        )
                    status = response.status_code
                    if 500 <= status <= 599 and status != 503:
                        failures.append(f"{method} {rule.rule} as {role} -> {status}")
        assert not failures, "routes crashed on plain requests:\n" + "\n".join(failures)
    finally:
        # This sweep hits rate-limited endpoints too — leave a clean slate.
        server_module.limiter.reset()
