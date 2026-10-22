from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def setup_cors(app: FastAPI) -> None:
    """Configure Cross-Origin Resource Sharing (CORS) middleware for the FastAPI app.

    Allows frontend web clients to communicate with backend APIs across origins.

    Args:
        app: The FastAPI application instance to configure.
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
