# The API now takes the caller's role from a signed-in session (api/auth.py). Most tests exercise the engine and
# workflow through the API, so they keep the old X-Role header; tests/test_auth.py covers sign-in itself.
import os

os.environ.setdefault("ALLOW_ROLE_HEADER", "1")


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_concern_rate_limit():
    """POST /concerns allows a few concerns a minute per connection; every test client shares one address."""
    import api.main as M
    M._CONCERN_HITS.clear()
    yield
