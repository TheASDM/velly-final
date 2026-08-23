from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("health", __name__)

@bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "loremaster"})

__all__ = ['health']
