FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

EXPOSE 3001

CMD ["gunicorn", "-b", "0.0.0.0:3001", "-w", "2", "--timeout", "120", "server:app"]
