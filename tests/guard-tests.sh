#!/bin/sh
# Request-level tests of the safeguards. Run ONLY against Zotero started with a
# separate test profile and data directory, never against your real library.
#
#   SAFE_EDIT_TOKEN=<token of a test client> \
#   TEST_GROUP=<group id of a test group> \
#   TEST_ITEM=<key of a regular item in that group> \
#   tests/guard-tests.sh
#
# Tests which need a manual setting (auto-sync on, item in trash, …) are listed
# in README.md under "Manual tests".

URL=http://localhost:23119/safe-edit
fail=0

check() { # description, expected substring, actual
  case "$3" in
    *"$2"*) echo "PASS  $1" ;;
    *) echo "FAIL  $1"; echo "      expected: $2"; echo "      got:      $3"; fail=1 ;;
  esac
}

post() { # endpoint, json, extra curl args...
  ep=$1; data=$2; shift 2
  curl -s -w ' HTTP%{http_code}' -X POST "$URL/$ep" \
    -H 'Content-Type: application/json' "$@" -d "$data"
}

auth="X-Safe-Edit-Token: $SAFE_EDIT_TOKEN"
change() { # field old new
  printf '{"group_id":%s,"item_key":"%s","field":"%s","old":"%s","new":"%s"}' \
    "$TEST_GROUP" "$TEST_ITEM" "$1" "$2" "$3"
}

check "no token is refused" "HTTP401" "$(post status '{}')"
check "wrong token is refused" "HTTP401" "$(post status '{}' -H 'X-Safe-Edit-Token: nope')"
check "request with Origin header is dropped" "HTTP000" \
  "$(post status '{}' -H "$auth" -H 'Origin: https://example.org')"
check "browser user agent is dropped" "HTTP000" \
  "$(post status '{}' -H "$auth" -A 'Mozilla/5.0')"
check "foreign Host header is refused" "HTTP400" \
  "$(post status '{}' -H "$auth" -H 'Host: evil.example.org')"
check "valid token is accepted" "HTTP200" "$(post status '{}' -H "$auth")"

check "field not in allow-list is rejected" "is not allowed" \
  "$(post preview "{\"changes\":[$(change title x y)]}" -H "$auth")"
check "unknown item is rejected" "Item not found" \
  "$(post preview "{\"changes\":[{\"group_id\":$TEST_GROUP,\"item_key\":\"ZZZZZZZZ\",\"field\":\"DOI\",\"old\":\"\",\"new\":\"10.1/x\"}]}" -H "$auth")"
check "wrong old value is rejected" "differs from the expected old value" \
  "$(post preview "{\"changes\":[$(change DOI 'not-the-current-value' '10.1/x')]}" -H "$auth")"
check "unchanged value is rejected" "are the same" \
  "$(post preview "{\"changes\":[$(change DOI '10.1/x' '10.1/x')]}" -H "$auth")"

many=$(i=0; s=""; while [ $i -lt 30 ]; do s="$s$(change DOI '' "10.1/$i"),"; i=$((i+1)); done; echo "${s%,}")
check "batch larger than the limit is refused" "Too many changes" \
  "$(post apply "{\"changes\":[$many]}" -H "$auth")"

check "group which is not in Zotero is rejected" "is not in this Zotero" \
  "$(post preview '{"changes":[{"group_id":1,"item_key":"AAAAAAAA","field":"DOI","old":"","new":"10.1/x"}]}' -H "$auth")"

exit $fail
