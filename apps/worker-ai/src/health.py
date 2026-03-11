"""Health check endpoint for the AI worker."""


def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "compyl-worker-ai"}


if __name__ == "__main__":
    print(health_check())
