ROUTE_CONTRACT = """
/api/admin/config|/api/admin/config|GET|admin_config|200:json.configured,google_client_id|200:json.configured,google_client_id|200:json.configured,google_client_id|200:json.configured,google_client_id
/api/admin/login|/api/admin/login|POST|admin_login|401:json.error,error_code|401:json.error,error_code|401:json.error,error_code|401:json.error,error_code
/api/admin/lore-submissions|/api/admin/lore-submissions|GET|admin_lore_submissions|401:json.error,error_code|401:json.error,error_code|200:json.submissions|200:json.submissions
/api/admin/lore-submissions/<submission_id>|/api/admin/lore-submissions/missing|GET|admin_lore_submission_detail|401:json.error,error_code|401:json.error,error_code|404:json.error|404:json.error
/api/admin/lore-submissions/<submission_id>/draft|/api/admin/lore-submissions/missing/draft|POST|admin_lore_submission_redraft|401:json.error,error_code|401:json.error,error_code|404:json.error|404:json.error
/api/admin/lore-submissions/<submission_id>/publish|/api/admin/lore-submissions/missing/publish|POST|admin_lore_submission_publish|401:json.error,error_code|401:json.error,error_code|404:json.error|404:json.error
/api/admin/lore-submissions/<submission_id>/reject|/api/admin/lore-submissions/missing/reject|POST|admin_lore_submission_reject|401:json.error,error_code|401:json.error,error_code|404:json.error|404:json.error
/api/admin/lore-submissions/<submission_id>/save|/api/admin/lore-submissions/missing/save|POST|admin_lore_submission_save|401:json.error,error_code|401:json.error,error_code|404:json.error|404:json.error
/api/admin/messages|/api/admin/messages|GET|admin_messages|401:json.error,error_code|401:json.error,error_code|200:json.messages|200:json.messages
/api/admin/messages/<int:message_id>|/api/admin/messages/1|DELETE|dm_message_delete|401:json.error,error_code|401:json.error,error_code|404:json.error|404:json.error
/api/admin/rebuild|/api/admin/rebuild|GET|admin_rebuild|401:json.error,error_code|401:json.error,error_code|200:json.rebuild|200:json.rebuild
/api/admin/session|/api/admin/session|GET|admin_session|200:json.configured,reason,signed_in|200:json.configured,reason,signed_in|200:json.app_auth,configured,email,signed_in|200:json.configured,email,signed_in
/api/admin/wiki-entry|/api/admin/wiki-entry|GET|admin_wiki_entry|401:json.error,error_code|401:json.error,error_code|404:json.error|404:json.error
/api/art-styles|/api/art-styles|GET|art_styles|200:json.default,styles|200:json.default,styles|200:json.default,styles|200:json.default,styles
/api/auth/config|/api/auth/config|GET|auth_config|200:json.authConfigured,legacyCodeLogin,loginRequired,players,providers|200:json.authConfigured,legacyCodeLogin,loginRequired,players,providers|200:json.authConfigured,legacyCodeLogin,loginRequired,players,providers|200:json.authConfigured,legacyCodeLogin,loginRequired,players,providers
/api/auth/login|/api/auth/login|POST|auth_login|400:json.error|400:json.error|400:json.error|400:json.error
/api/auth/logout|/api/auth/logout|POST|auth_logout|200:json.ok|200:json.ok|200:json.ok|200:json.ok
/api/auth/oauth/<provider>/callback|/api/auth/oauth/discord/callback|GET|auth_oauth_callback|302:text/html.redirect|302:text/html.redirect|302:text/html.redirect|302:text/html.redirect
/api/auth/oauth/<provider>/start|/api/auth/oauth/discord/start|GET|auth_oauth_start|302:text/html.redirect|302:text/html.redirect|302:text/html.redirect|302:text/html.redirect
/api/auth/session|/api/auth/session|GET|auth_session|401:json.error|200:json.isDm,loginRequired,ok,playerName,provider|200:json.isDm,loginRequired,ok,playerName,provider|401:json.error
/api/availability|/api/availability|GET|availability|401:json.error|200:json.entries,playerName,updated_at|200:json.entries,playerName,updated_at|401:json.error
/api/availability/summary|/api/availability/summary|GET|availability_summary|401:json.error,error_code|401:json.error,error_code|200:json.days,submitted|200:json.days,submitted
/api/calendar/<event_id>.ics|/api/calendar/sample.ics|GET|calendar_event_ics|404:text/html|404:text/html|404:text/html|404:text/html
/api/calendar/events|/api/calendar/events|GET|calendar_events|200:json.events|200:json.events|200:json.events|200:json.events
/api/calendar/events/<int:event_id>|/api/calendar/events/1|PUT|calendar_event_detail|401:json.error,error_code|401:json.error,error_code|404:json.error|404:json.error
/api/calendar/events/<int:event_id>.ics|/api/calendar/events/1.ics|GET|calendar_event_db_ics|404:text/html|404:text/html|404:text/html|404:text/html
/api/calendar/next|/api/calendar/next|GET|calendar_next|200:json.gathering|200:json.gathering|200:json.gathering|200:json.gathering
/api/chat|/api/chat|POST|chat|400:json.error|400:json.error|400:json.error|400:json.error
/api/descriptions|/api/descriptions|GET|list_descriptions|200:json.categories|200:json.categories|200:json.categories|200:json.categories
/api/gallery|/api/gallery|GET|list_gallery|200:json.entries,limit,offset,scope,total|200:json.entries,limit,offset,scope,total|200:json.entries,limit,offset,scope,total|200:json.entries,limit,offset,scope,total
/api/gallery/<gallery_id>|/api/gallery/missing|DELETE|gallery_delete|401:json.error,error_code|401:json.error,error_code|400:json.error|400:json.error
/api/gallery/<gallery_id>/favorite|/api/gallery/missing/favorite|POST|gallery_favorite|401:json.error|404:json.error,error_code|404:json.error,error_code|401:json.error
/api/gallery/<gallery_id>/pin|/api/gallery/missing/pin|POST|gallery_pin|400:json.error,error_code|400:json.error,error_code|400:json.error,error_code|400:json.error,error_code
/api/gallery/<gallery_id>/share|/api/gallery/missing/share|POST|gallery_share|404:json.error,error_code|404:json.error,error_code|404:json.error,error_code|404:json.error,error_code
/api/gallery/favorites|/api/gallery/favorites|GET|gallery_favorites_list|401:json.error|200:json.ids|200:json.ids|401:json.error
/api/gallery/image/<path:filename>|/api/gallery/image/missing.png|GET|gallery_image|404:text/html|404:text/html|404:text/html|404:text/html
/api/generate-image|/api/generate-image|POST|generate_image|400:json.error|400:json.error|400:json.error|400:json.error
/api/in-play|/api/in-play|GET|in_play_endpoint|200:json.items|200:json.items|200:json.items|200:json.items
/api/lore-submissions|/api/lore-submissions|POST|lore_submission_create|401:json.error|400:json.error|400:json.error|401:json.error
/api/lore-submissions/<submission_id>|/api/lore-submissions/missing|GET|lore_submission_detail|404:json.error|404:json.error|404:json.error|404:json.error
/api/lore-submissions/<submission_id>/image|/api/lore-submissions/missing/image|GET|lore_submission_image|404:text/html|404:text/html|404:text/html|404:text/html
/api/lore-submissions/mine|/api/lore-submissions/mine|GET|lore_submissions_mine|401:json.error|200:json.submissions|200:json.submissions|401:json.error
/api/messages|/api/messages|GET|dm_messages|401:json.error|200:json.messages|200:json.messages|401:json.error
/api/messages/<int:message_id>|/api/messages/1|DELETE|dismiss_message|401:json.error|404:json.error|404:json.error|401:json.error
/api/notes|/api/notes|GET|notes_endpoint|401:json.error|200:json.notes,scope|200:json.notes,scope|401:json.error
/api/notes/<note_id>|/api/notes/missing|PUT|note_endpoint|401:json.error|404:json.error|404:json.error|401:json.error
/api/push/config|/api/push/config|GET|push_config|200:json.publicKey,pushConfigured|200:json.publicKey,pushConfigured|200:json.publicKey,pushConfigured|200:json.publicKey,pushConfigured
/api/push/opened|/api/push/opened|POST|push_opened|400:json.error|400:json.error|400:json.error|400:json.error
/api/push/send|/api/push/send|POST|push_send|401:json.error,error_code|401:json.error,error_code|503:json.error|503:json.error
/api/push/subscribe|/api/push/subscribe|POST|push_subscribe|503:json.error|503:json.error|503:json.error|503:json.error
/api/push/subscribers|/api/push/subscribers|GET|push_subscribers|401:json.error,error_code|401:json.error,error_code|200:json.missing,subscribed|200:json.missing,subscribed
/api/questionnaire|/api/questionnaire|GET|questionnaire|401:json.error|200:json.answers,playerName,status,submitted_at,updated_at|200:json.answers,playerName,status,submitted_at,updated_at|401:json.error
/api/questionnaire/all|/api/questionnaire/all|GET|questionnaire_all|401:json.error,error_code|401:json.error,error_code|200:json.records|200:json.records
/api/questionnaire/submit|/api/questionnaire/submit|POST|questionnaire_submit|401:json.error|400:json.error|400:json.error|401:json.error
/api/rsvp|/api/rsvp|GET|rsvp|400:json.error|400:json.error|400:json.error|400:json.error
/api/rumors|/api/rumors|GET|rumors|401:json.error,error_code|401:json.error,error_code|200:json.rumors|200:json.rumors
/api/rumors/<int:rumor_id>|/api/rumors/1|DELETE|rumors_delete|401:json.error,error_code|401:json.error,error_code|200:json.deleted,ok|404:json.error
/api/rumors/roll|/api/rumors/roll|GET|rumors_roll|200:json.rumor|200:json.rumor|200:json.rumor|200:json.rumor
/api/sheet|/api/sheet|GET|api_my_sheet|401:json.error|200:json.ok,playerName,sheet,statblock|200:json.ok,playerName,sheet,statblock|401:json.error
/api/sheets|/api/sheets|GET|api_all_sheets|401:json.error,error_code|401:json.error,error_code|200:json.ok,sheets|200:json.ok,sheets
/api/statblocks/ingest|/api/statblocks/ingest|POST|api_statblock_ingest|503:json.error,error_code|503:json.error,error_code|503:json.error,error_code|503:json.error,error_code
/api/studio/generate|/api/studio/generate|POST|studio_generate|400:json.error,error_code|400:json.error,error_code|400:json.error,error_code|400:json.error,error_code
/api/studio/jobs|/api/studio/jobs|GET|studio_jobs|400:json.error|400:json.error|400:json.error|400:json.error
/api/studio/jobs/<job_id>|/api/studio/jobs/missing|GET|studio_job|404:json.error|404:json.error|404:json.error|404:json.error
/health|/health|GET|health|200:json.service,status|200:json.service,status|200:json.service,status|200:json.service,status
/static/<path:filename>|/static/missing.png|GET|static|404:text/html|404:text/html|404:text/html|404:text/html
""".strip()

ROLES = ("anonymous", "player", "dm", "google_dm")


def _response_shape(response):
    data = response.get_json(silent=True)
    if isinstance(data, dict):
        return "json." + ",".join(sorted(data))
    if isinstance(data, list):
        return "json.list"
    return response.mimetype + (".redirect" if response.headers.get("Location") else "")


def _cases():
    for line in ROUTE_CONTRACT.splitlines():
        rule, path, method, endpoint, *role_contracts = line.split("|")
        expected = {}
        for role, contract in zip(ROLES, role_contracts):
            status, shape = contract.split(":", 1)
            expected[role] = (int(status), shape)
        yield rule, path, method, endpoint, expected


def test_route_inventory_and_response_contract(app, auth_headers):
    cases = list(_cases())
    actual_routes = {
        rule.rule
        for rule in app.url_map.iter_rules()
        if rule.methods.intersection({"GET", "POST", "PUT", "PATCH", "DELETE"})
    }
    expected_routes = {rule for rule, _, _, _endpoint, _ in cases}
    assert actual_routes == expected_routes
    assert len(cases) == 66

    for rule, path, method, _endpoint, expected in cases:
        for role in ROLES:
            with app.test_client() as client:
                response = client.open(
                    path,
                    method=method,
                    json={} if method != "GET" else None,
                    headers=auth_headers[role],
                )
            actual = (response.status_code, _response_shape(response))
            assert actual == expected[role], f"{method} {rule} as {role}"
