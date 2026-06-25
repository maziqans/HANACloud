import os
from pathlib import Path
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-dev-key-change-in-prod')
DEBUG = True
ALLOWED_HOSTS = ['*'] # Accept connections from Coolify proxy
CSRF_TRUSTED_ORIGINS = ['https://cloud-api.hanacasa.my']

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'wsgi.application'

# Configure DRF to use JWT authentication
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=90),
}

# Database: Wire it up to the Coolify injected PostgreSQL container
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'hanacloud'),
        'USER': os.environ.get('POSTGRES_USER', 'postgres'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
        'HOST': os.environ.get('POSTGRES_HOST', 'db'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# THIS IS CRITICAL: Map Media Root to the hardware volume path
MEDIA_URL = '/media/'
MEDIA_ROOT = '/app/storage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Allow Next.js frontend to communicate with this Django API
CORS_ALLOW_ALL_ORIGINS = True

# --- LARGE FILE UPLOAD SETTINGS ---
# Route large uploads to the persistent storage volume instead of the tiny container /tmp disk
FILE_UPLOAD_TEMP_DIR = os.path.join(MEDIA_ROOT, 'tmp')
os.makedirs(FILE_UPLOAD_TEMP_DIR, exist_ok=True)

# Force streaming: files > 2MB go directly to disk via TemporaryUploadedFile
# This prevents RAM exhaustion when multiple files upload concurrently
FILE_UPLOAD_HANDLERS = [
    'django.core.files.uploadhandler.TemporaryFileUploadHandler',
    'django.core.files.uploadhandler.MemoryFileUploadHandler',
]

# Max allowed request body size (5GB ceiling for very large files)
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024 * 1024  # 5 GB
# Files larger than 2MB stream directly to disk (not held in RAM)
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024          # 2 MB