"""Gunicorn compatibility shim for the modular Vallombrosa API."""

if __package__:
    from .vos.runtime import *
else:
    from vos.runtime import *


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001, debug=False)
