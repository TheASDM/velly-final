from scripts.chat_identity_integrity import build_report


def test_chat_identity_integrity_report_is_content_blind_and_green(server_module):
    report = build_report(server_module.APP_DB_PATH)

    assert report["ok"] is True
    assert report["integrity"] == "ok"
    assert report["migration_applied"] is True
    assert report["missing_tables"] == []
    assert all(
        count == 0
        for values in report["missing_identity_values"].values()
        for count in values.values()
    )
    assert all(count == 0 for count in report["relationship_mismatches"].values())
