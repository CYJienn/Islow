from fastapi.testclient import TestClient

from app.main import app


def test_health_check() -> None:
    response = TestClient(app).get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_widget_from_description() -> None:
    response = TestClient(app).post(
        "/api/v1/chat",
        json={"text": "/create line chart of sales"},
    )

    assert response.status_code == 200
    assert response.json()["type"] == "widget"
    assert response.json()["spec"]["blocks"][0]["type"] == "line"
