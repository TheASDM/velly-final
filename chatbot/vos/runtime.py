"""Assemble the modular API while preserving legacy import-time startup."""

import logging
from importlib import import_module

from . import config


CORE_MODULES = [
    import_module(name, __package__)
    for name in (
        ".auth",
        ".migrations_legacy",
        ".migrations_current",
        ".db",
        ".rebuild",
        ".logging_utils",
        ".engine.prompts",
        ".engine.knowledge",
        ".engine.retrieval",
        ".engine.anthropic",
        ".engine.loremaster",
        ".services.gallery",
        ".services.descriptions",
        ".services.images",
        ".services.studio",
        ".services.lore_context",
        ".services.lore_generation",
        ".services.wiki_source",
        ".services.wiki_render",
        ".services.publishing",
        ".web",
    )
]


def _collect(modules):
    registry = {}
    for module in modules:
        for name in getattr(module, "__all__", ()):
            registry[name] = getattr(module, name)
    return registry


def _inject(modules, registry):
    for module in modules:
        module.__dict__.update(registry)


registry = _collect([config, *CORE_MODULES])
_inject(CORE_MODULES, registry)

from .engine.loremaster import Loremaster
from .web import app, limiter

engine = Loremaster()
registry.update({"app": app, "limiter": limiter, "engine": engine})
_inject(CORE_MODULES, registry)

ROUTE_MODULES = [
    import_module(name, __package__)
    for name in (
        ".routes.auth",
        ".routes.admin",
        ".routes.calendar",
        ".routes.push",
        ".routes.messages",
        ".routes.notes",
        ".routes.in_play",
        ".routes.rsvp",
        ".routes.availability",
        ".routes.questionnaire",
        ".routes.sheets",
        ".routes.rumors",
        ".routes.chat",
        ".routes.lore",
        ".routes.studio",
        ".routes.gallery",
        ".routes.health",
    )
]
registry.update(_collect(ROUTE_MODULES))
_inject([*CORE_MODULES, *ROUTE_MODULES], registry)

for module in ROUTE_MODULES:
    app.register_blueprint(module.bp)

registry["_run_app_migrations"]()
engine.load()
logging.info("Loremaster ready (player-only)")

globals().update(registry)
__all__ = sorted(set(registry) | {"app", "engine", "limiter", "Loremaster"})
