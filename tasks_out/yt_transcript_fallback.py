import argparse
import html
import json
import urllib.request
import xml.etree.ElementTree as ET


def parse_timedtext(xml_text):
    if not isinstance(xml_text, str):
        return []

    try:
        root = ET.fromstring(xml_text)
    except Exception:
        try:
            root = ET.fromstring("<root>" + xml_text + "</root>")
        except Exception:
            return []

    entries = []
    for element in root.iter("text"):
        try:
            start = float(element.get("start", 0.0))
        except Exception:
            start = 0.0
        try:
            dur = float(element.get("dur", 0.0))
        except Exception:
            dur = 0.0
        text = html.unescape("".join(element.itertext()))
        entries.append({"start": start, "dur": dur, "text": text})

    return entries


def parse_player_response(html_text):
    if not isinstance(html_text, str):
        return {}

    marker = html_text.find("ytInitialPlayerResponse")
    if marker == -1:
        return {}

    start = html_text.find("{", marker)
    if start == -1:
        return {}

    depth = 0
    in_string = False
    escape = False
    end = -1

    for pos in range(start, len(html_text)):
        ch = html_text[pos]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
        else:
            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = pos
                    break

    if end == -1:
        return {}

    try:
        value = json.loads(html_text[start:end + 1])
    except Exception:
        return {}

    return value if isinstance(value, dict) else {}


def caption_track_urls(player_response):
    if not isinstance(player_response, dict):
        return []

    try:
        tracks = player_response["captions"]["playerCaptionsTracklistRenderer"]["captionTracks"]
        urls = [track["baseUrl"] for track in tracks]
        if not all(isinstance(url, str) for url in urls):
            return []
        return urls
    except Exception:
        return []


def _selftest():
    xml_sample = (
        '<transcript>'
        '<text start="0" dur="1.5">Hello &amp; world</text>'
        '<text start="1.5" dur="2">A &lt; B&amp;#39;s</text>'
        '</transcript>'
    )
    assert parse_timedtext(xml_sample) == [
        {"start": 0.0, "dur": 1.5, "text": "Hello & world"},
        {"start": 1.5, "dur": 2.0, "text": "A < B's"},
    ]

    assert parse_timedtext(None) == []
    assert parse_timedtext("") == []

    html_sample = (
        'x ytInitialPlayerResponse = '
        '{"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":'
        '[{"baseUrl":"https://example.com/a"},{"baseUrl":"https://example.com/b"}]}}};'
    )
    player = parse_player_response(html_sample)
    assert player == {
        "captions": {
            "playerCaptionsTracklistRenderer": {
                "captionTracks": [
                    {"baseUrl": "https://example.com/a"},
                    {"baseUrl": "https://example.com/b"},
                ]
            }
        }
    }
    assert caption_track_urls(player) == [
        "https://example.com/a",
        "https://example.com/b",
    ]

    assert parse_player_response(123) == {}
    assert parse_player_response("not here") == {}
    assert caption_track_urls({}) == []
    assert caption_track_urls(None) == []

    print("PASS")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--video-id")
    args = parser.parse_args()

    if args.selftest:
        _selftest()

    if args.video_id:
        url = "https://www.youtube.com/api/timedtext?v=" + args.video_id + "&lang=en"
        try:
            request = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(request, timeout=10) as response:
                body = response.read().decode("utf-8", "replace")
            print(len(parse_timedtext(body)))
        except Exception:
            print(0)


if __name__ == "__main__":
    main()
