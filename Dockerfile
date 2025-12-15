# Dockerfile minimal pour une application Python
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Dépendances système utiles (adapter selon vos besoins)
RUN apt-get update && apt-get install -y --no-install-recommends build-essential gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY src /src
COPY static /static

EXPOSE 8042
expose 5550

# Remplacez par le point d'entrée de votre application
CMD ["python", "src/main.py"]