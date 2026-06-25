FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Gather all the CSS and JS files for the Admin dashboard
RUN python manage.py collectstatic --noinput

# Run with gevent async workers — handles hundreds of concurrent uploads
# without blocking (unlike sync workers that starve after ~6 connections)
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--worker-class", "gevent", "--workers", "4", "--timeout", "3600", "wsgi:application"]