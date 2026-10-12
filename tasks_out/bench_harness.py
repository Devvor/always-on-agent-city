#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

AUTH_PATH = "/opt/data/shared/nous_auth.json"
API_URL = "https://inference-api.nousresearch.com/v1/chat/completions"
DEFAULT_PROMPTS = "/opt/data/missingno-worker/bench_prompts.json"

FENCE_RE = re.compile(r"
