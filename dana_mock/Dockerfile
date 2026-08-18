# Servicio standalone y deliberadamente liviano — build context es este directorio
# (dana_mock/), no el repo completo. Sin credenciales de BD: simula un sistema
# externo (DANA) que tampoco tendría acceso a nuestra BD propia/sig.

FROM python:3.12-slim AS runtime

RUN groupadd --system app && useradd --system --gid app --create-home app

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./dana_mock/

USER app
ENV PYTHONUNBUFFERED=1

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8100/health')" || exit 1

CMD ["uvicorn", "dana_mock.main:app", "--host", "0.0.0.0", "--port", "8100"]
