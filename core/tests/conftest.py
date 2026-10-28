import pytest

from core.gateway import Gateway
from core.tests.support import seed_dictionary


@pytest.fixture
def gw(tmp_path):
    gateway = Gateway(tmp_path / "h.db")
    yield gateway
    gateway.close()


@pytest.fixture
def seeded(gw):
    seed_dictionary(gw)
    return gw
