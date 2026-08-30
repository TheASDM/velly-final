"""Shared standard-library and framework imports for the API package."""

import base64
import fcntl
import hashlib
import hmac
import html
import io
import json
import logging
import os
import re
import secrets
import shutil
import sqlite3
import string
import subprocess
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import requests as http_requests
import yaml
from PIL import Image
from flask import (
    Blueprint,
    Flask,
    Response,
    abort,
    jsonify,
    make_response,
    redirect,
    request,
    send_from_directory,
    stream_with_context,
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

try:
    from pywebpush import WebPushException, webpush as send_webpush
except ImportError:
    WebPushException = Exception
    send_webpush = None
