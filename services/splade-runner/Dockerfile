FROM nvidia/cuda:12.1.0-base-ubuntu22.04

WORKDIR /app

# Install Python 3.11 and requirements for uv
RUN apt-get update && apt-get install --no-install-recommends -y \
    python3.11 \
    python3.11-distutils \
    python3.11-venv \
    curl \
    ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install latest pip for Python 3.11 (Debian disables ensurepip)
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Upgrade core packaging tools with the freshly installed pip
RUN python3.11 -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Install PyTorch first from CUDA index
RUN python3.11 -m pip install --no-cache-dir torch==2.3.0 --index-url https://download.pytorch.org/whl/cu121

# Install remaining packages from PyPI
RUN python3.11 -m pip install --no-cache-dir fastapi uvicorn pydantic transformers numpy

# Verify uvicorn is installed
RUN python3.11 -c "import uvicorn; print('uvicorn installed successfully')"

# Copy application code
COPY app/ ./app/

# Expose port
EXPOSE 8000

# Set environment variables
ENV MODEL_NAME=naver/splade-cocondenser-ensembledistil
ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python3.11", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
