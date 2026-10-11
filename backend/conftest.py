import os, tempfile
os.environ.update(TQ_DB=os.path.join(tempfile.mkdtemp(), "t.db"), DEV_MODE="true", JWT_SECRET="test-secret-for-tests-only-0123456789", DEMO_MODE="true")
import pytest


@pytest.fixture(autouse=True)
def reset_limits():
    import auth, main
    auth._fails.clear(); main.hits.clear()
    yield
